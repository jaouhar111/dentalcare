/**
 * Sanity check: send a `hello_world` template to a verified recipient.
 *
 * Why a template and not free-text? Meta only allows free-form text
 * within a 24h customer-care window opened by an inbound from the user.
 * Before that window exists, only pre-approved templates work.
 * `hello_world` is the default Meta-shipped template — always present.
 *
 * Run:  pnpm tsx scripts/test-whatsapp-send.ts +212663448449
 */

import "dotenv/config";

const META = "https://graph.facebook.com/v21.0";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: pnpm tsx scripts/test-whatsapp-send.ts <+E164>");
    process.exit(1);
  }
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID in .env");
    process.exit(1);
  }
  const normalized = to.startsWith("+") ? to : `+${to}`;
  console.log(`📤 Sending hello_world template to ${normalized}\n`);

  const res = await fetch(`${META}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalized,
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    }),
  });
  const json = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message: string; code: number; error_data?: { details?: string } };
  };
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok || json.error) {
    console.error(`\n❌ ${json.error?.message ?? "unknown error"}`);
    if (json.error?.error_data?.details) {
      console.error(`   ${json.error.error_data.details}`);
    }
    process.exit(1);
  }
  console.log(
    `\n✅ Sent (message id: ${json.messages?.[0]?.id}). Check WhatsApp on ${normalized} — should arrive within a few seconds.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
