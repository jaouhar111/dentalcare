import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ALL_TEMPLATES,
  META_LANGUAGE_CODE,
  type TemplateSpec,
  type WhatsAppLocale,
} from "./templates";

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface MetaCreds {
  token: string;
  phoneId: string;
  appSecret: string;
}

function readCreds(): MetaCreds | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!token || !phoneId || !appSecret) return null;
  return { token, phoneId, appSecret };
}

/**
 * Send a pre-approved template message to a Moroccan E.164 phone number.
 *
 * Dev mode (no Meta creds): log to console + return `{ ok, mocked: true }`.
 * Prod mode: POST to Meta Graph API and surface its response.
 *
 * The caller (Server Action) provides only the typed parameter map — this
 * function flattens it to the Meta API `components[0].parameters` ordering.
 */
export async function sendTemplate<P extends Record<string, string>>(args: {
  to: string;
  template: TemplateSpec<P>;
  locale: WhatsAppLocale;
  params: P;
  /** Optional URL-button suffix used when the template has a dynamic URL slot. */
  urlButtonParam?: string;
}): Promise<{ ok: true; messageId?: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();

  // Build a flat string array in the order declared by the template spec.
  const paramValues = args.template.params.map((k) => args.params[k] ?? "");

  if (!creds) {
    console.log(
      `[whatsapp:mock] template=${args.template.name} lang=${args.locale} to=${args.to}`,
      paramValues,
    );
    return { ok: true, mocked: true };
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.template.name,
      language: { code: META_LANGUAGE_CODE[args.locale] },
      components: [
        {
          type: "body",
          parameters: paramValues.map((text) => ({ type: "text", text })),
        },
        ...(args.urlButtonParam
          ? [
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: args.urlButtonParam }],
              },
            ]
          : []),
      ],
    },
  };

  try {
    const res = await fetch(`${META_GRAPH_BASE}/${creds.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };
    if (!res.ok) {
      const err = json.error?.message ?? `Meta API ${res.status}`;
      console.error("[whatsapp] send failed", { template: args.template.name, to: args.to, err });
      return { ok: false, error: err };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] network error", { err: message });
    return { ok: false, error: message };
  }
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verifies Meta's `X-Hub-Signature-256` header (HMAC-SHA256 of the raw body
 * keyed with `WHATSAPP_APP_SECRET`). Returns `true` on match.
 *
 * In dev mode (no creds), we accept everything — this lets tests POST mock
 * webhooks without juggling secrets.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const creds = readCreds();
  if (!creds) return true; // dev mode

  if (!header || !header.startsWith("sha256=")) return false;
  const signature = header.slice("sha256=".length);
  const expected = createHmac("sha256", creds.appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Validates the Meta GET-verification handshake: when first registering the
 * webhook URL, Meta hits it with `?hub.mode=subscribe&hub.verify_token=…
 * &hub.challenge=…`. We echo back `challenge` iff `verify_token` matches the
 * one we configured.
 */
export function verifyWebhookChallenge(searchParams: URLSearchParams): string | null {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected && challenge) {
    return challenge;
  }
  return null;
}

// ─── Quick-reply parsing helpers ─────────────────────────────────────────────

/**
 * Walks the Meta webhook payload for incoming button clicks. Returns an array
 * of `{ from, payload }` for every quick-reply button pressed in this batch.
 * Unknown payloads are surfaced as-is for the caller to ignore.
 */
export function parseQuickReplies(
  body: unknown,
): Array<{ from: string; payload: string; messageId: string }> {
  const out: Array<{ from: string; payload: string; messageId: string }> = [];
  if (!body || typeof body !== "object") return out;
  const entries = (body as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } }).value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const msg of messages) {
        const m = msg as {
          from?: string;
          id?: string;
          type?: string;
          button?: { payload?: string };
          interactive?: { button_reply?: { id?: string } };
        };
        const payload = m.button?.payload ?? m.interactive?.button_reply?.id;
        if (m.from && m.id && payload) {
          out.push({ from: m.from, payload, messageId: m.id });
        }
      }
    }
  }
  return out;
}

export { ALL_TEMPLATES };
