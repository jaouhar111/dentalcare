/**
 * Lists every template attached to the WABA, with name + language + status.
 * Lets us confirm Meta sees the template we just created and which exact
 * language code it stored (`fr` vs `fr_FR` — they're not interchangeable).
 *
 * Needs `WHATSAPP_BUSINESS_ID` (the WABA id, not the phone id). If we don't
 * have it in .env we look it up via the phone number → WABA association.
 */
import "dotenv/config";

const META = "https://graph.facebook.com/v21.0";

async function main() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID");
    process.exit(1);
  }

  // Resolve WABA id — the `debug_token` endpoint returns the app's
  // granular scopes including the WABA the token can manage. Older path
  // (whatsapp_business_account on phone) was deprecated in v18+.
  const dbgRes = await fetch(
    `${META}/debug_token?input_token=${token}&access_token=${token}`,
  );
  const dbg = (await dbgRes.json()) as {
    data?: {
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
  };
  const wabaScope = dbg.data?.granular_scopes?.find(
    (s) => s.scope === "whatsapp_business_management",
  );
  const wabaId = wabaScope?.target_ids?.[0] ?? process.env.WHATSAPP_BUSINESS_ID;
  if (!wabaId) {
    console.error("Could not resolve WABA id from token scopes. Add WHATSAPP_BUSINESS_ID to .env.");
    console.error(JSON.stringify(dbg, null, 2));
    process.exit(1);
  }
  console.log(`WABA id: ${wabaId}\n`);

  const res = await fetch(`${META}/${wabaId}/message_templates?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    data?: Array<{
      name: string;
      language: string;
      status: string;
      category: string;
      id: string;
    }>;
    error?: { message: string };
  };
  if (!res.ok || json.error) {
    console.error(json.error?.message ?? `HTTP ${res.status}`);
    process.exit(1);
  }
  const templates = json.data ?? [];
  console.log(`${templates.length} template(s) on this WABA:\n`);
  for (const t of templates) {
    const status = t.status === "APPROVED" ? "✅" : t.status === "PENDING" ? "⏳" : "❌";
    console.log(
      `  ${status} ${t.name.padEnd(30)} ${t.language.padEnd(6)} ${t.status.padEnd(10)} ${t.category}`,
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
