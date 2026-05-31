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

/**
 * Send a plain-text WhatsApp message (no template). Used by the AI
 * booking flow to reply mid-conversation.
 *
 * Constraint: Meta only allows free-form text within a 24h
 * customer-care window after the user's last inbound message. The AI
 * webhook always satisfies that because the patient JUST messaged us,
 * but generic outbound messaging (reminders, recalls) must still go
 * through `sendTemplate`.
 *
 * Dev mode (no Meta creds): log + return `{ ok, mocked: true }`.
 */
export async function sendText(args: {
  to: string;
  body: string;
}): Promise<{ ok: true; messageId?: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();

  if (!creds) {
    console.log(`[whatsapp:mock-text] to=${args.to} :: ${args.body}`);
    return { ok: true, mocked: true };
  }

  const body = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "text",
    text: { body: args.body, preview_url: false },
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
      console.error("[whatsapp] sendText failed", { to: args.to, err });
      return { ok: false, error: err };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] sendText network error", { err: message });
    return { ok: false, error: message };
  }
}

/**
 * Uploads a binary blob to Meta's media endpoint and returns the
 * `media_id` we can then attach to an outbound audio/image message.
 * Meta keeps the file for 30 days, which is plenty for the immediate
 * send. Dev fallback: returns a fake id so callers can no-op without
 * network. Note: uses multipart/form-data — `Buffer` → `Blob` here.
 */
export async function uploadMedia(args: {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ ok: true; mediaId: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) {
    console.log(`[whatsapp:mock-upload] ${args.mimeType} ${args.buffer.length}b`);
    return { ok: true, mediaId: "mock-media-id", mocked: true };
  }
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", args.mimeType);
  form.append(
    "file",
    new Blob([args.buffer as unknown as ArrayBuffer], { type: args.mimeType }),
    args.filename ?? "voice.wav",
  );
  const res = await fetch(`${META_GRAPH_BASE}/${creds.phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}` },
    body: form,
  });
  const json = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || json.error || !json.id) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, mediaId: json.id };
}

/**
 * Sends a voice/audio message referencing a previously-uploaded
 * `media_id`. Mirrors `sendText` so the caller can swap one for the
 * other when a patient sent audio.
 */
export async function sendAudio(args: {
  to: string;
  mediaId: string;
}): Promise<{ ok: true; messageId?: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) {
    console.log(`[whatsapp:mock-audio] to=${args.to} mediaId=${args.mediaId}`);
    return { ok: true, mocked: true };
  }
  const body = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "audio",
    audio: { id: args.mediaId },
  };
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
  if (!res.ok || json.error) {
    return { ok: false, error: json.error?.message ?? `Meta API ${res.status}` };
  }
  return { ok: true, messageId: json.messages?.[0]?.id };
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verifies Meta's `X-Hub-Signature-256` header (HMAC-SHA256 of the raw body
 * keyed with `WHATSAPP_APP_SECRET`). Returns `true` on match.
 *
 * In dev mode (no creds), we accept everything — this lets tests POST mock
 * webhooks without juggling secrets.
 *
 * SECURITY: in production we MUST refuse missing creds. Otherwise a
 * mis-configured deploy (env var dropped, secret rotated without restart)
 * silently degrades to "accept everything", letting anyone forge inbound
 * patient messages, create appointments, and trigger billing actions.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const creds = readCreds();
  if (!creds) {
    if (process.env.NODE_ENV === "production") {
      console.error("[whatsapp] CRITICAL: missing creds in production — rejecting webhook");
      return false;
    }
    return true; // dev mode only
  }

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
/**
 * Walks the Meta webhook payload for plain-text inbound messages.
 * Returns `{ from, body, messageId }` for each text message in the
 * batch — those are the ones the AI engine handles.
 *
 * Button replies are NOT included here (use `parseQuickReplies` for
 * those) so the two paths stay separate in the route handler.
 */
export function parseTextMessages(
  body: unknown,
): Array<{ from: string; body: string; messageId: string }> {
  const out: Array<{ from: string; body: string; messageId: string }> = [];
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
          text?: { body?: string };
        };
        if (m.type === "text" && m.from && m.id && m.text?.body) {
          out.push({ from: m.from, body: m.text.body, messageId: m.id });
        }
      }
    }
  }
  return out;
}

/**
 * Walks the Meta webhook payload for inbound audio messages (voice notes).
 * Returns `{ from, mediaId, mimeType, messageId }` per audio so the
 * caller can download + transcribe before feeding the result to the AI
 * engine as if it were a text message.
 *
 * Meta classifies both `voice` (recorded inside WhatsApp) and `audio`
 * (attached audio file) types — we accept both because patients use
 * either interchangeably.
 */
export function parseAudioMessages(
  body: unknown,
): Array<{ from: string; mediaId: string; mimeType: string; messageId: string }> {
  const out: Array<{ from: string; mediaId: string; mimeType: string; messageId: string }> = [];
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
          audio?: { id?: string; mime_type?: string };
          voice?: { id?: string; mime_type?: string };
        };
        const audio = m.audio ?? m.voice;
        if ((m.type === "audio" || m.type === "voice") && m.from && m.id && audio?.id) {
          out.push({
            from: m.from,
            mediaId: audio.id,
            mimeType: audio.mime_type ?? "audio/ogg",
            messageId: m.id,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Downloads a media file (voice note, image, etc.) referenced by its
 * Meta media id. Returns `{ buffer, mimeType }` ready to be handed to
 * Gemini (which accepts inline base64).
 *
 * Two HTTP hops by design: Meta API returns a signed CDN URL that
 * itself needs the bearer token to fetch — that's the documented flow,
 * no shortcut.
 */
export async function downloadMedia(mediaId: string): Promise<
  { ok: true; buffer: Buffer; mimeType: string } | { ok: false; error: string }
> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, error: "WHATSAPP_TOKEN missing" };

  const metaRes = await fetch(`${META_GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta = (await metaRes.json()) as {
    url?: string;
    mime_type?: string;
    error?: { message: string };
  };
  if (!metaRes.ok || meta.error || !meta.url) {
    return { ok: false, error: meta.error?.message ?? `metadata ${metaRes.status}` };
  }
  const blobRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!blobRes.ok) {
    return { ok: false, error: `blob ${blobRes.status}` };
  }
  const arr = await blobRes.arrayBuffer();
  return { ok: true, buffer: Buffer.from(arr), mimeType: meta.mime_type ?? "audio/ogg" };
}

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
