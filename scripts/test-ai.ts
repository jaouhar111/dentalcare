/**
 * Smoke test for the AI cascade (Gemini → Groq).
 *
 * Sends a short prompt + a single function-calling tool and prints the
 * provider response (text + tool calls + tokens + latency). Useful right
 * after adding/rotating an API key to confirm the wiring works before
 * touching real product code.
 *
 * Run with:
 *   pnpm tsx scripts/test-ai.ts
 *
 * Exits 0 on success, 1 on any error so it can be plugged into CI later.
 */

import "dotenv/config";
import { z } from "zod";
import { aiCascade } from "@/lib/ai/cascade";
import type { AITool } from "@/lib/ai/types";

const slotsTool: AITool = {
  name: "search_available_slots",
  description: "Find appointment slots for a given dentist + day. Returns at most 3.",
  parameters: z.object({
    dentistName: z.string().describe("First name of the dentist, e.g. 'Otmane'"),
    day: z.string().describe("ISO date YYYY-MM-DD"),
  }),
  // The handler isn't called in this smoke test — we only verify the
  // model emits a properly-shaped function call. Returning a fixture
  // here keeps the type signature happy.
  handler: async (args) => {
    return { slots: ["09:00", "10:30", "14:00"], echo: args };
  },
};

async function main() {
  if (!aiCascade.isConfigured) {
    console.error(
      "\n❌ No AI provider configured.\n" +
        "   Set GEMINI_API_KEY (and/or GROQ_API_KEY) in .env then rerun.\n",
    );
    process.exit(1);
  }

  console.log("\n🔌 Provider cascade ready. Sending test prompt…\n");

  // 1) Pure text — does the model reply in French?
  const textOnly = await aiCascade.chat({
    messages: [
      {
        role: "system",
        content:
          "Tu es l'assistant du Cabinet Dentaire Dr Hdoude à Fès. Réponds en français, ton chaleureux.",
      },
      {
        role: "user",
        content: "Bonjour, vous êtes ouverts samedi ?",
      },
    ],
    temperature: 0.2,
    maxTokens: 200,
  });

  console.log("━━━ Texte simple ━━━");
  console.log(`provider : ${textOnly.provider}`);
  console.log(`latence  : ${textOnly.latencyMs} ms`);
  console.log(
    `tokens   : prompt=${textOnly.usage?.promptTokens ?? "?"} / completion=${textOnly.usage?.completionTokens ?? "?"}`,
  );
  console.log(`reply    : ${textOnly.text}\n`);

  // 2) Function calling — does the model emit a tool call with correct args?
  const tooled = await aiCascade.chat({
    messages: [
      {
        role: "system",
        content:
          "Tu aides les patients à prendre RDV. Utilise les outils dispo pour chercher des créneaux. " +
          "Aujourd'hui = 2026-05-28.",
      },
      {
        role: "user",
        content: "Je voudrais un RDV avec Dr Otmane jeudi prochain.",
      },
    ],
    tools: [slotsTool],
    temperature: 0,
    maxTokens: 300,
  });

  console.log("━━━ Function calling ━━━");
  console.log(`provider   : ${tooled.provider}`);
  console.log(`latence    : ${tooled.latencyMs} ms`);
  console.log(`text       : ${tooled.text || "(vide — l'IA a appelé un outil au lieu de répondre)"}`);
  console.log(`tool calls : ${tooled.toolCalls.length}`);
  for (const call of tooled.toolCalls) {
    console.log(`  → ${call.name}(${JSON.stringify(call.args)})`);
  }

  console.log("\n✅ Cascade fonctionnelle.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test échoué :", err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
