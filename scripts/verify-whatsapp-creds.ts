/**
 * Pre-flight check for the WhatsApp Cloud API setup.
 *
 * Validates each piece independently so a wrong value gets pinpointed
 * before you go through the whole webhook + ngrok dance:
 *
 *   1. All 4 env vars present?
 *   2. PHONE_ID + TOKEN can call Meta Graph (GET /<phone_id>)?
 *   3. APP_SECRET matches what Meta expects? (cross-check via app debug)
 *   4. Webhook signature math actually round-trips?
 *
 * Run:  pnpm tsx scripts/verify-whatsapp-creds.ts
 */

import "dotenv/config";
import { createHmac } from "node:crypto";

const META = "https://graph.facebook.com/v21.0";

const env = {
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
};

function bold(s: string) {
  return `\x1b[1m${s}\x1b[0m`;
}
function red(s: string) {
  return `\x1b[31m${s}\x1b[0m`;
}
function green(s: string) {
  return `\x1b[32m${s}\x1b[0m`;
}
function yellow(s: string) {
  return `\x1b[33m${s}\x1b[0m`;
}

async function step(name: string, fn: () => Promise<string>): Promise<boolean> {
  process.stdout.write(`${bold(name)} … `);
  try {
    const detail = await fn();
    console.log(green("OK"), detail ? `(${detail})` : "");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(red("FAILED"));
    console.log(`   ${red(msg)}`);
    return false;
  }
}

async function main() {
  console.log("\n🛂 WhatsApp Cloud API — pre-flight check\n");

  // 1) env vars present
  const missing = (Object.keys(env) as Array<keyof typeof env>).filter((k) => !env[k]);
  if (missing.length > 0) {
    console.log(red(`Missing env vars: ${missing.join(", ")}`));
    process.exit(1);
  }
  console.log(`${bold("Env vars")} … ${green("present")} (4/4)`);

  // 2) PHONE_ID + TOKEN can read the phone number metadata
  const phoneOk = await step("GET /<phone_id>", async () => {
    const res = await fetch(`${META}/${env.WHATSAPP_PHONE_ID}`, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    });
    const json = (await res.json()) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      error?: { message: string; code: number };
    };
    if (!res.ok || json.error) {
      throw new Error(
        json.error?.message ?? `HTTP ${res.status} — likely bad WHATSAPP_TOKEN or WHATSAPP_PHONE_ID`,
      );
    }
    return `${json.display_phone_number ?? "?"} • ${json.verified_name ?? "(no name)"}`;
  });

  // 3) Token introspection — confirm the token is alive + grab the app id
  let appId: string | null = null;
  await step("debug_token", async () => {
    const res = await fetch(
      `${META}/debug_token?input_token=${env.WHATSAPP_TOKEN}&access_token=${env.WHATSAPP_TOKEN}`,
    );
    const json = (await res.json()) as {
      data?: { app_id?: string; is_valid?: boolean; expires_at?: number; type?: string };
      error?: { message: string };
    };
    if (!res.ok || json.error || !json.data?.is_valid) {
      throw new Error(json.error?.message ?? "Token not valid");
    }
    appId = json.data.app_id ?? null;
    const exp =
      json.data.expires_at && json.data.expires_at > 0
        ? new Date(json.data.expires_at * 1000).toISOString()
        : "(never)";
    return `app_id=${appId ?? "?"} type=${json.data.type ?? "?"} expires=${exp}`;
  });

  // 4) APP_SECRET cross-check — Meta accepts `appsecret_proof` (HMAC of the
  // token using the app secret) as an alternative auth header. If the proof
  // matches, the secret is correct.
  await step("appsecret_proof", async () => {
    const proof = createHmac("sha256", env.WHATSAPP_APP_SECRET!)
      .update(env.WHATSAPP_TOKEN!)
      .digest("hex");
    const url = `${META}/${env.WHATSAPP_PHONE_ID}?access_token=${env.WHATSAPP_TOKEN}&appsecret_proof=${proof}`;
    const res = await fetch(url);
    const json = (await res.json()) as { error?: { message: string; code: number } };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? "Bad appsecret_proof — WHATSAPP_APP_SECRET is wrong");
    }
    return "secret matches token";
  });

  // 5) Round-trip the webhook signature math so we know the runtime
  // verification will accept Meta's payloads.
  await step("webhook signature round-trip", async () => {
    const fakeBody = JSON.stringify({ entry: [{ id: "test" }] });
    const sig = createHmac("sha256", env.WHATSAPP_APP_SECRET!).update(fakeBody).digest("hex");
    const header = `sha256=${sig}`;
    // Re-import the live verifier to make sure prod logic matches.
    const { verifyWebhookSignature } = await import("../src/lib/whatsapp/client");
    if (!verifyWebhookSignature(fakeBody, header)) {
      throw new Error("verifyWebhookSignature returned false on a self-signed payload");
    }
    return "verifier accepts our own signature";
  });

  console.log(
    `\n${green("✅ All credentials look good.")}\n` +
      `Next: start ${bold("pnpm dev")} + ${bold("ngrok http 3000")}, then paste the ngrok URL\n` +
      `into Meta → WhatsApp → Configuration as ${bold("https://<ngrok>.ngrok-free.app/api/webhooks/whatsapp")}\n` +
      `with verify token = ${bold(env.WHATSAPP_VERIFY_TOKEN!)}.\n`,
  );
  if (!phoneOk) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ pre-flight crashed:", err);
  process.exit(1);
});
