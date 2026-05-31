/**
 * Live inspector: dumps the conversation history for the +212663448449
 * sandbox, plus the recent audit log entries — so we can see exactly
 * what the bot replied during the real WhatsApp test.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const phone = "+212663448449";
  const convo = await db.aIConversation.findFirst({
    where: { patientPhone: phone },
    select: {
      id: true,
      status: true,
      totalTurns: true,
      totalTokens: true,
      historyJson: true,
      lastActivityAt: true,
      createdAt: true,
    },
  });
  if (!convo) {
    console.log(`(no conversation for ${phone})`);
    return;
  }
  console.log(`\n📞 ${phone} — conversation ${convo.id}`);
  console.log(
    `   status=${convo.status} turns=${convo.totalTurns} tokens=${convo.totalTokens}`,
  );
  console.log(`   last activity=${convo.lastActivityAt.toISOString()}\n`);

  const history = Array.isArray(convo.historyJson) ? (convo.historyJson as unknown[]) : [];
  console.log(`📜 History (${history.length} messages):`);
  for (let i = 0; i < history.length; i++) {
    const m = history[i] as { role?: string; content?: string; name?: string; toolCalls?: unknown[] };
    const arrow =
      m.role === "user" ? "👤" : m.role === "assistant" ? "🤖" : m.role === "tool" ? "🔧" : "?";
    const tag = m.toolCalls && m.toolCalls.length > 0 ? " [+toolCalls]" : "";
    const body = (m.content ?? "").replace(/\s+/g, " ").slice(0, 150);
    console.log(`  ${i + 1}. ${arrow} ${m.role}${tag}: ${body}`);
  }

  const audits = await db.auditLog.findMany({
    where: { entity: "AIConversation", entityId: convo.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { action: true, createdAt: true, payloadJson: true },
  });
  console.log(`\n📋 Recent audit entries (${audits.length}):`);
  for (const a of audits) {
    const p = a.payloadJson as { replyText?: string; userMessage?: string } | null;
    console.log(`  ${a.createdAt.toISOString()}  ${a.action}`);
    if (p?.userMessage) console.log(`    in : ${p.userMessage.slice(0, 100)}`);
    if (p?.replyText) console.log(`    out: ${p.replyText.slice(0, 150)}`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
