/**
 * Groq Llama 3.3 70B provider — fallback when Gemini hits its quota.
 *
 * Groq is OpenAI-compatible, so function calling uses the standard
 * `tools: [{ type: "function", function: { name, parameters } }]` shape.
 * Latency is typically < 500ms (LPU silicon) which makes it a great
 * fallback — patients don't notice the cascade flipped.
 */

import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import type { AIProvider, AITool, ChatMessage, ChatRequest, ChatResponse } from "./types";
import { ProviderFailoverError } from "./types";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 8_000;

export class GroqProvider implements AIProvider {
  readonly name = "groq" as const;
  private readonly client: Groq;
  private readonly modelName: string;

  constructor() {
    if (!env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY missing — cannot use GroqProvider");
    }
    this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    this.modelName = env.GROQ_MODEL || DEFAULT_MODEL;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    const messages = req.messages.map(toGroqMessage);
    const tools = req.tools && req.tools.length > 0 ? toGroqTools(req.tools) : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    req.signal?.addEventListener("abort", () => controller.abort());

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.modelName,
          messages,
          tools,
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 1024,
          // Groq's tool_choice "auto" mirrors Gemini's default behaviour:
          // the model picks whether to call a tool or reply.
          tool_choice: tools ? "auto" : undefined,
        },
        { signal: controller.signal },
      );
      const choice = completion.choices[0];
      const text = choice?.message?.content ?? "";
      const toolCalls = (choice?.message?.tool_calls ?? []).map((t) => ({
        id: t.id,
        name: t.function.name,
        // Groq returns args as a stringified JSON — parse here so callers
        // can validate the parsed object with the tool's zod schema.
        args: safeJsonParse(t.function.arguments),
      }));
      const usage = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : null;
      return {
        text,
        toolCalls,
        provider: "groq",
        usage,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      throw classifyGroqError(err);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function toGroqMessage(m: ChatMessage) {
  if (m.role === "tool") {
    return {
      role: "tool" as const,
      content: m.content,
      tool_call_id: m.toolCallId ?? "",
    };
  }
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: "assistant" as const,
      content: m.content || null,
      tool_calls: m.toolCalls.map((t) => ({
        id: t.id,
        type: "function" as const,
        function: {
          name: t.name,
          arguments: typeof t.args === "string" ? t.args : JSON.stringify(t.args),
        },
      })),
    };
  }
  return { role: m.role as "system" | "user" | "assistant", content: m.content };
}

function toGroqTools(tools: AITool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}

function classifyGroqError(err: unknown): ProviderFailoverError {
  if (err instanceof ProviderFailoverError) return err;
  // Groq SDK throws `APIError` with `.status`. We classify defensively.
  type AnyErr = { status?: number; message?: string; name?: string };
  const e = err as AnyErr;
  const message = e.message ?? String(err);
  if (e.name === "AbortError") {
    return new ProviderFailoverError("groq", "timeout", message);
  }
  if (e.status === 429) {
    return new ProviderFailoverError("groq", "rate_limit", message);
  }
  if (e.status && e.status >= 500) {
    return new ProviderFailoverError("groq", "server", message);
  }
  if (e.status === 401 || e.status === 403) {
    return new ProviderFailoverError("groq", "unauthorized", message);
  }
  return new ProviderFailoverError("groq", "unknown", message);
}

/**
 * Minimal zod → JSON-Schema converter for OpenAI/Groq function-calling.
 * Same scope as the Gemini converter — bolted-on rather than via a
 * dedicated package to keep the bundle slim. Extend as new tools land.
 */
function zodToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  let current: z.ZodTypeAny = zodType;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodNullable
  ) {
    current = current._def.innerType as z.ZodTypeAny;
  }

  if (current instanceof z.ZodObject) {
    const shape = current.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      const isOptional = value instanceof z.ZodOptional || value instanceof z.ZodDefault;
      if (!isOptional) required.push(key);
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  if (current instanceof z.ZodString) return { type: "string" };
  if (current instanceof z.ZodNumber) return { type: "number" };
  if (current instanceof z.ZodBoolean) return { type: "boolean" };
  if (current instanceof z.ZodEnum) {
    // zod v4: `.options` returns the enum's allowed values.
    return { type: "string", enum: current.options as readonly string[] };
  }
  if (current instanceof z.ZodArray) {
    // zod v4: `.element` is typed as the internal `$ZodType`; cast to
    // the public `ZodTypeAny` for the recursive call.
    return { type: "array", items: zodToJsonSchema(current.element as z.ZodTypeAny) };
  }
  // eslint-disable-next-line no-console
  console.warn(`[ai/groq] unsupported zod type, fell back to string: ${current.constructor.name}`);
  return { type: "string" };
}
