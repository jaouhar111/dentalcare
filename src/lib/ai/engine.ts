/**
 * Conversational engine — the "tool-use loop" for the AI booking flow.
 *
 * Caller pattern:
 *
 *     const result = await runBookingConversation({
 *       context: { clinicId, patientId, userId },
 *       systemPrompt: buildDentalSystemPrompt({ clinicName, todayIso }),
 *       history: previousMessages,
 *       userMessage: "Je voudrais un RDV avec Dr Hdoude jeudi",
 *     });
 *     // result.text → assistant's final reply to send back via WhatsApp
 *     // result.messages → updated history to persist for the next turn
 *     // result.toolRuns → trace of every tool that fired (for audit)
 *
 * # Loop logic
 *
 *     ┌── append user message to history
 *     │
 *     ▼
 *   model.chat(history + tools)
 *     │
 *     ├── if response.toolCalls.length === 0 → DONE, return text
 *     │
 *     └── else for each tool call:
 *           1. lookup tool by name
 *           2. validate args against the tool's zod schema
 *           3. await tool.handler(parsed args)
 *           4. append tool result as `role: "tool"` message
 *           5. loop back to step (model.chat)
 *
 * # Safety
 *
 * Hard cap at `MAX_ITERATIONS` (5) to prevent runaway loops if the
 * model keeps calling tools without ever replying. Cap at 5 means up to
 * ~10 model round-trips per patient message — way more than needed for
 * any realistic booking flow.
 */

import { aiCascade } from "./cascade";
import { buildBookingTools, type AIToolContext } from "./tools";
import type { ChatMessage, ChatToolCall } from "./types";

const MAX_ITERATIONS = 5;

export interface BookingConversationInput {
  context: AIToolContext;
  systemPrompt: string;
  /// Prior turns of THIS patient's conversation (loaded from
  /// `AIConversation` table in the webhook handler).
  history: ChatMessage[];
  /// The inbound patient message about to be answered.
  userMessage: string;
}

export interface BookingConversationResult {
  /// Final assistant text — what to send back via WhatsApp.
  text: string;
  /// Complete updated history including the user input + assistant reply
  /// + every intermediate tool round-trip. Persist this to
  /// `AIConversation.history` for the next turn.
  messages: ChatMessage[];
  /// Audit trail of tool calls — feed into `audit_log` for traceability.
  toolRuns: ToolRunRecord[];
  /// Provider that answered the LAST call (gemini | groq).
  provider: "gemini" | "groq";
  /// Sum of tokens used across all loop iterations.
  totalTokens: number;
}

export interface ToolRunRecord {
  iteration: number;
  toolName: string;
  args: unknown;
  result: unknown;
  /// Set when the model emitted args that didn't pass zod validation.
  validationError?: string;
  /// Set when the tool's own handler threw.
  runtimeError?: string;
}

export async function runBookingConversation(
  input: BookingConversationInput,
): Promise<BookingConversationResult> {
  const tools = buildBookingTools(input.context);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  let messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    ...input.history,
    { role: "user", content: input.userMessage },
  ];
  const toolRuns: ToolRunRecord[] = [];
  let totalTokens = 0;
  let lastProvider: "gemini" | "groq" = "gemini";

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await aiCascade.chat({
      messages,
      tools,
      temperature: 0.2,
      maxTokens: 1024,
    });
    lastProvider = response.provider;
    if (response.usage) totalTokens += response.usage.totalTokens;

    // Terminal case — model replied with plain text, no more tools.
    if (response.toolCalls.length === 0) {
      messages.push({ role: "assistant", content: response.text });
      // Drop the seeded system message so the persisted history stays
      // small + the system prompt can evolve between turns.
      return {
        text: response.text,
        messages: messages.slice(1), // drop system
        toolRuns,
        provider: lastProvider,
        totalTokens,
      };
    }

    // Assistant turn that emitted tool calls — append it with the calls
    // so the next iteration's history is coherent (Groq especially
    // requires the assistant message + tool message pairing).
    messages.push({
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    });

    // Execute each tool call. On validation/runtime error we feed the
    // error back to the model as the tool result; that lets it recover
    // (re-emit corrected args) on the next iteration instead of crashing.
    for (const call of response.toolCalls) {
      const record = await runOneToolCall({ call, toolByName, iteration });
      toolRuns.push(record);
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(record.result ?? { error: record.validationError ?? record.runtimeError }),
      });
    }
  }

  // Loop exhausted — return what we have with a notice so the caller
  // can surface "I'm stuck, please contact the cabinet directly."
  const fallback = "Je n'arrive pas à finaliser ta demande, peux-tu reformuler ?";
  messages.push({ role: "assistant", content: fallback });
  return {
    text: fallback,
    messages: messages.slice(1),
    toolRuns,
    provider: lastProvider,
    totalTokens,
  };
}

async function runOneToolCall({
  call,
  toolByName,
  iteration,
}: {
  call: ChatToolCall;
  toolByName: Map<string, ReturnType<typeof buildBookingTools>[number]>;
  iteration: number;
}): Promise<ToolRunRecord> {
  const tool = toolByName.get(call.name);
  if (!tool) {
    return {
      iteration,
      toolName: call.name,
      args: call.args,
      result: null,
      validationError: `Unknown tool: ${call.name}`,
    };
  }
  const parsed = tool.parameters.safeParse(call.args);
  if (!parsed.success) {
    return {
      iteration,
      toolName: call.name,
      args: call.args,
      result: null,
      validationError: parsed.error.message,
    };
  }
  try {
    const result = await tool.handler(parsed.data);
    return {
      iteration,
      toolName: call.name,
      args: parsed.data,
      result,
    };
  } catch (err) {
    return {
      iteration,
      toolName: call.name,
      args: parsed.data,
      result: null,
      runtimeError: err instanceof Error ? err.message : String(err),
    };
  }
}
