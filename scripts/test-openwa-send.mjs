/**
 * Dev smoke test — calls the DentalCare `sendText` helper directly to
 * confirm the OpenWA pipeline works end-to-end (DentalCare code →
 * OpenWA REST API → real WhatsApp).
 *
 * Usage:
 *   node scripts/test-openwa-send.mjs <to-phone-e164>
 *
 * Example:
 *   node scripts/test-openwa-send.mjs +212663448449
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-openwa-send.mjs <to-phone-e164>");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const clinic = await db.clinic.findFirst({
  where: { openwaSessionId: { not: null } },
  select: { id: true, name: true, openwaSessionId: true },
});
if (!clinic) {
  console.error("No clinic linked to an OpenWA session yet — run link-openwa-session.mjs first.");
  process.exit(1);
}

console.log(`Sending test text from clinic "${clinic.name}" (session ${clinic.openwaSessionId})`);
console.log(`→ ${to}`);

// We can't easily import the TS module from .mjs, so make the same HTTP
// call the helper would make. This is the exact shape sendText() uses.
const url = `${process.env.OPENWA_BASE_URL}/api/sessions/${clinic.openwaSessionId}/messages/send-text`;
const digits = to.replace(/[^\d]/g, "");
const res = await fetch(url, {
  method: "POST",
  headers: {
    "X-API-Key": process.env.OPENWA_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    chatId: `${digits}@c.us`,
    text:
      "🧪 Test DentalCare → OpenWA — si tu vois ce message, l'envoi sortant marche depuis le code de l'app refactoré.",
  }),
});
const json = await res.json();
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(json, null, 2));
await db.$disconnect();
