/**
 * Provider-agnostic chat types — sit between the business code and the
 * vendor SDKs (Gemini, Groq) so swapping providers requires zero callsite
 * changes. Function-calling format mirrors OpenAI's so we can plug a
 * future fallback (OpenAI, Anthropic) without touching tool definitions.
 */

import type { z } from "zod";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /// When the assistant wants to invoke a tool, the SDK returns these
  /// instead of a plain text answer. Each `id` matches the tool result
  /// the caller sends back on the next turn.
  toolCalls?: ChatToolCall[];
  /// When `role === "tool"`, this maps the message back to the original
  /// `toolCalls[i].id` so the model knows which call this is the result of.
  toolCallId?: string;
  /// Optional name on `role === "tool"` — some providers (Groq) require it.
  name?: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  /// Already JSON-parsed args. Validate against the tool's zod schema
  /// before executing — the model may emit malformed shapes despite the
  /// declared `parameters`.
  args: unknown;
}

/**
 * Tool definition exposed to the AI. Each tool's input shape is described
 * by a zod schema; the cascade serialises that to a JSON-Schema for the
 * model and revalidates the model's args against it before invoking the
 * handler.
 *
 * Keep tool names short, snake_case, and verb-first ("search_slots",
 * "create_appointment") — that matches Gemini / Groq's preferred style.
 */
export interface AITool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: TSchema;
  handler: (args: z.infer<TSchema>) => Promise<unknown>;
}

/**
 * Helper that captures the zod-schema generic so the handler's `args`
 * is typed against the schema instead of `unknown`. Without it, a literal
 * `{ name, parameters: z.object({...}), handler: async (args) => {} }`
 * defaults `TSchema` to `ZodTypeAny`, leaving `args` opaque.
 */
export function defineTool<T extends z.ZodTypeAny>(spec: AITool<T>): AITool<T> {
  return spec;
}

export interface ChatRequest {
  /// Ordered conversation history. The first message can be a `system`
  /// message that pins the persona; subsequent turns alternate user /
  /// assistant.
  messages: ChatMessage[];
  /// Tools the model is allowed to call. Empty array = chat-only.
  tools?: AITool[];
  /// Sampling temperature — 0.2 for booking flows (deterministic), 0.7+
  /// only for creative copy.
  temperature?: number;
  /// Hard cap on output tokens; lets us bound cost per request.
  maxTokens?: number;
  /// Abort signal passed through to the SDK. Use it to time-out a call
  /// after N seconds and let the cascade fall over to the next provider.
  signal?: AbortSignal;
}

export interface ChatResponse {
  /// Always present — either the assistant's reply or the last text part
  /// before a function call. Empty string when the model only emitted
  /// tool calls.
  text: string;
  /// Tool calls the model wants the caller to execute. When non-empty,
  /// the caller is expected to run each tool's handler and append the
  /// results as `role: "tool"` messages, then call `chat` again.
  toolCalls: ChatToolCall[];
  /// Provider that actually answered — useful for billing/observability.
  provider: "gemini" | "groq";
  /// Token usage when the provider reports it (Gemini does, Groq via
  /// `usage` object). `null` when the provider didn't expose it.
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  /// Wall-clock latency of the underlying SDK call (ms).
  latencyMs: number;
}

/**
 * Common contract every provider impl must satisfy. The cascade owns
 * fallover; individual providers stay dumb.
 */
export interface AIProvider {
  readonly name: "gemini" | "groq";
  chat(req: ChatRequest): Promise<ChatResponse>;
}

/** Sentinel error a provider throws when it wants the cascade to retry on
 *  the next provider (rate limit, transient 5xx, timeout). */
export class ProviderFailoverError extends Error {
  constructor(
    public readonly provider: "gemini" | "groq",
    public readonly cause: "rate_limit" | "timeout" | "server" | "unauthorized" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ProviderFailoverError";
  }
}
