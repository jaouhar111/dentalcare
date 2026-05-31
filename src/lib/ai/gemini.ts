/**
 * Google Gemini 2.0 Flash provider — primary leg of the cascade.
 *
 * Free tier: 1500 requests/day, 1M tokens/minute. We never hit that with a
 * single cabinet doing ≤ 50 patient messages/day, but the cascade catches
 * the 429 anyway and routes to Groq.
 *
 * Function-calling shape: Gemini uses `tools: [{ functionDeclarations: [...] }]`
 * with `Schema` (JSON-Schema subset) for parameters. We translate from zod
 * via `zod-to-json-schema`-like inline mapping; for V1 we only support the
 * primitive types we actually use (string, number, boolean, enum, object).
 */

import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { z } from "zod";
import { env } from "@/lib/env";
import type { AIProvider, AITool, ChatRequest, ChatResponse } from "./types";
import { ProviderFailoverError } from "./types";

// `gemini-flash-lite-latest` = the stable alias for the cheapest/most
// generously-quota'd Gemini in 2026. Newly-created projects get ~15k
// requests/day on the lite tier, vs 0 on `gemini-2.0-flash`. Faster +
// cheaper than 2.5-pro, plenty enough for booking flows.
// Override via GEMINI_MODEL once you upgrade to a paid project.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
// 20s — tool-use turns with conversation history routinely take 8-15s on
// the lite tier. Tighter timeouts make the cascade flap to Groq for
// recoverable slowness instead of waiting it out.
const TIMEOUT_MS = 20_000;

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY missing — cannot use GeminiProvider");
    }
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.modelName = env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const tools = req.tools && req.tools.length > 0 ? toGeminiTools(req.tools) : undefined;
    const startedAt = Date.now();
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      tools,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: req.maxTokens ?? 1024,
      },
    });

    // Gemini's Chat API takes `history` (everything except the last) +
    // `sendMessage(lastUserMessage)`. We follow that split.
    const contents = req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : m.role === "tool" ? "function" : "user",
      parts:
        m.role === "tool"
          ? [{ functionResponse: { name: m.name ?? "", response: { content: m.content } } }]
          : [{ text: m.content }],
    }));

    const timeout = setupTimeout(req.signal);
    try {
      const result = await Promise.race([
        model.generateContent({ contents }),
        timeout.promise,
      ]);
      const response = result.response;
      const candidate = response.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => ("text" in p ? p.text : "")).join("") ?? "";
      // Gemini's `Part` union has many shapes (text / functionCall /
       // codeExecutionResult / inlineData…). We only care about
       // functionCall here, so we narrow at use-time rather than via a
       // type predicate (which TS refuses to write across the full union).
      const toolCalls = (candidate?.content?.parts ?? [])
        .map((p, i) => {
          const fc = (p as { functionCall?: { name: string; args: unknown } }).functionCall;
          if (!fc) return null;
          return {
            id: `gemini-${Date.now()}-${i}`,
            name: fc.name,
            args: fc.args,
          };
        })
        .filter((x): x is { id: string; name: string; args: unknown } => x !== null);
      const usage = response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : null;
      return {
        text,
        toolCalls,
        provider: "gemini",
        usage,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      throw classifyGeminiError(err);
    } finally {
      timeout.cancel();
    }
  }
}

function setupTimeout(externalSignal?: AbortSignal): {
  promise: Promise<never>;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let externalListener: (() => void) | null = null;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ProviderFailoverError("gemini", "timeout", `Gemini timed out after ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );
    if (externalSignal) {
      externalListener = () => reject(new Error("Aborted"));
      externalSignal.addEventListener("abort", externalListener);
    }
  });
  return {
    promise,
    cancel: () => {
      if (timer) clearTimeout(timer);
      if (externalListener && externalSignal) externalSignal.removeEventListener("abort", externalListener);
    },
  };
}

function classifyGeminiError(err: unknown): ProviderFailoverError {
  if (err instanceof ProviderFailoverError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("quota") || lower.includes("rate") || lower.includes("429")) {
    return new ProviderFailoverError("gemini", "rate_limit", msg);
  }
  if (lower.includes("401") || lower.includes("permission") || lower.includes("unauthor")) {
    return new ProviderFailoverError("gemini", "unauthorized", msg);
  }
  if (lower.includes("5") && /\b5\d\d\b/.test(msg)) {
    return new ProviderFailoverError("gemini", "server", msg);
  }
  return new ProviderFailoverError("gemini", "unknown", msg);
}

/**
 * Convert our zod-typed `AITool[]` into Gemini's `FunctionDeclaration[]`.
 *
 * We hand-walk the zod tree to JSON-Schema instead of pulling in
 * `zod-to-json-schema`: the tools we use are simple flat objects with
 * primitives + enums + dates, and dragging in another dep would bloat
 * the serverless bundle. Extend `zodToSchema` only when a new tool
 * needs a type not handled here.
 */
function toGeminiTools(tools: AITool[]): NonNullable<Parameters<GoogleGenerativeAI["getGenerativeModel"]>[0]["tools"]> {
  return [
    {
      functionDeclarations: tools.map(toGeminiFunction),
    },
  ];
}

function toGeminiFunction(tool: AITool): FunctionDeclaration {
  const schema = zodToGeminiSchema(tool.parameters);
  return {
    name: tool.name,
    description: tool.description,
    parameters: schema,
  };
}

/** Minimal zod → Gemini Schema converter — covers object/string/number/
 *  boolean/enum/array/date. Extend as we add tools. */
function zodToGeminiSchema(zodType: z.ZodTypeAny): FunctionDeclaration["parameters"] {
  // Unwrap ZodOptional / ZodNullable / ZodDefault
  let current: z.ZodTypeAny = zodType;
  let optional = false;
  while (true) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodDefault || current instanceof z.ZodNullable) {
      optional = true;
      current = current._def.innerType as z.ZodTypeAny;
      continue;
    }
    break;
  }

  if (current instanceof z.ZodObject) {
    const shape = current.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, ReturnType<typeof zodToGeminiSchema>> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToGeminiSchema(value);
      const isOptional = value instanceof z.ZodOptional || value instanceof z.ZodDefault;
      if (!isOptional) required.push(key);
    }
    return {
      type: SchemaType.OBJECT,
      properties,
      required: required.length > 0 ? required : undefined,
    } as FunctionDeclaration["parameters"];
  }

  if (current instanceof z.ZodString) {
    return { type: SchemaType.STRING } as FunctionDeclaration["parameters"];
  }
  if (current instanceof z.ZodNumber) {
    return { type: SchemaType.NUMBER } as FunctionDeclaration["parameters"];
  }
  if (current instanceof z.ZodBoolean) {
    return { type: SchemaType.BOOLEAN } as FunctionDeclaration["parameters"];
  }
  if (current instanceof z.ZodEnum) {
    // zod v4: `.options` returns the array of allowed values directly.
    return {
      type: SchemaType.STRING,
      enum: current.options as readonly string[],
    } as unknown as FunctionDeclaration["parameters"];
  }
  if (current instanceof z.ZodArray) {
    // zod v4: `.element` exposes the array's item schema (typed as the
    // internal `$ZodType`; cast to the public `ZodTypeAny` for recursion).
    return {
      type: SchemaType.ARRAY,
      items: zodToGeminiSchema(current.element as z.ZodTypeAny),
    } as unknown as FunctionDeclaration["parameters"];
  }
  // Fallback for unsupported types — be loud rather than silently shipping
  // a malformed schema the model will hallucinate against.
  // eslint-disable-next-line no-console
  console.warn(`[ai/gemini] unsupported zod type, fell back to STRING: ${current.constructor.name}`);
  return { type: SchemaType.STRING } as FunctionDeclaration["parameters"];
  // (Note: `optional` is honoured by adding/omitting the field from `required` in the ZodObject branch.)
  // For top-level non-object schemas (rare) optionality is implicit.
  void optional;
}
