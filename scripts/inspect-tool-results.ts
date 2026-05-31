/**
 * Show the raw tool result rows from the latest conversation so we can
 * see exactly what `search_available_slots` returned (how many slots,
 * which localTime values, etc.) versus what the model chose to say.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

interface ChatMessage {
  role?: string;
  content?: string;
  name?: string;
  toolCalls?: Array<{ name: string; args: unknown }>;
}

async function main() {
  const convo = await db.aIConversation.findFirst({
    where: { patientPhone: "+212663448449" },
    select: { historyJson: true },
  });
  if (!convo) return console.log("no convo");
  const history = (convo.historyJson as unknown as ChatMessage[]) ?? [];
  console.log(`History: ${history.length} messages\n`);
  for (let i = 0; i < history.length; i++) {
    const m = history[i]!;
    if (m.role === "tool") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m.content ?? "null");
      } catch {
        parsed = m.content;
      }
      console.log(`[${i}] 🔧 tool ${m.name}`);
      console.log(`     ${JSON.stringify(parsed).slice(0, 600)}`);
    } else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length) {
      for (const tc of m.toolCalls) {
        console.log(`[${i}] 🤖→ ${tc.name}(${JSON.stringify(tc.args)})`);
      }
    } else if (m.role === "user") {
      console.log(`[${i}] 👤 ${m.content?.slice(0, 100)}`);
    } else if (m.role === "assistant") {
      console.log(`[${i}] 🤖 ${m.content?.slice(0, 150)}`);
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
