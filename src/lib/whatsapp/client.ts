import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * OpenWA gateway client — self-hosted WhatsApp Web bridge that replaces
 * Meta's Cloud API for sending and receiving messages.
 *
 * Why OpenWA over Meta Cloud API:
 *   - No Facebook Business verification or app review required
 *   - No 24h customer-care window — free-form text any time
 *   - No template pre-approval — every message is plain text
 *   - Per-cabinet onboarding via QR scan (≈2 minutes vs 3-5 days)
 *
 * Trade-offs (informational — engineering knows, the SaaS owner accepts):
 *   - Runs against unofficial whatsapp-web.js; numbers CAN be banned by WA
 *   - Requires a separately-hosted gateway (this codebase does not embed it)
 *   - One Puppeteer/Chromium session per cabinet at the gateway
 *
 * Two-mode service (per project convention):
 *   - env.OPENWA_BASE_URL + env.OPENWA_API_KEY present → real call
 *   - either missing → console.log mock so dev can run without the gateway
 *
 * Public surface kept compatible with the old Meta client where possible
 * so callers (reminders, AI handler) only need minor tweaks:
 *   sendText({ to, body, sessionId })
 *   sendAudio({ to, sessionId, buffer, mimetype })   // inline base64
 *   verifyWebhookSignature(rawBody, signatureHeader)
 *   parseTextMessages(body) → { from, body, messageId, sessionId }[]
 *   parseAudioMessages(body) → inline buffer + mimetype, no download step
 *   parseOwnerOutboundMessages(body) → uses native `fromMe` flag
 *
 * NEW (session management for /settings/ai-receptionist onboarding):
 *   openwaCreateSession, openwaStartSession, openwaGetQr,
 *   openwaSessionStatus, openwaRegisterWebhook
 */

interface OpenWaCreds {
  baseUrl: string;
  apiKey: string;
}

function readCreds(): OpenWaCreds | null {
  const baseUrl = env.OPENWA_BASE_URL;
  const apiKey = env.OPENWA_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

/**
 * Convert a phone/identifier into the OpenWA `chatId` format.
 *
 * Three input shapes are accepted:
 *   - `+212663448449`           → `212663448449@c.us`   (E.164 phone)
 *   - `+lid_278017930723384`    → `278017930723384@lid` (LID round-trip)
 *   - `212663448449@c.us`       → unchanged             (already chatId)
 *
 * The `@lid` round-trip handles WhatsApp's privacy-preserving Linked ID
 * format: non-saved contacts now arrive with an opaque `<digits>@lid`
 * identifier instead of their phone number. We stash the LID into the
 * patient-phone slot prefixed with `lid_` so the conversation key stays
 * deterministic, then unwrap it here when replying.
 */
function toChatId(input: string): string {
  if (input.includes("@")) return input;
  if (input.startsWith("+lid_")) {
    return `${input.slice("+lid_".length)}@lid`;
  }
  const digits = input.replace(/[^\d]/g, "");
  return `${digits}@c.us`;
}

/**
 * Inverse of `toChatId`. `@c.us` → `+digits`, `@lid` → `+lid_digits`.
 * Anything else returns the raw chatId so opaque identifiers (groups,
 * channels) stay traceable in audit logs.
 */
function chatIdToPhone(chatId: string): string {
  const [head, suffix] = chatId.split("@");
  if (!head) return chatId;
  if (suffix === "c.us") return `+${head}`;
  if (suffix === "lid") return `+lid_${head}`;
  return chatId;
}

async function openwaFetch<T>(
  creds: OpenWaCreds,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": creds.apiKey,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const errMsg =
        (json as { message?: string } | undefined)?.message ??
        `OpenWA ${res.status} ${res.statusText}`;
      return { ok: false, status: res.status, error: errMsg };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  }
}

// ─── Outbound messaging ───────────────────────────────────────────────────────

/**
 * Send a plain-text WhatsApp message via OpenWA.
 *
 * `sessionId` identifies which cabinet's WABA session sends the message.
 * Usually pulled from `Clinic.openwaSessionId`. When null/undefined or
 * when OpenWA creds are missing, the call mocks to console.log so the
 * dev workflow keeps running without a real gateway.
 */
export async function sendText(args: {
  to: string;
  body: string;
  sessionId?: string | null;
}): Promise<{ ok: true; messageId?: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds || !args.sessionId) {
    console.log(
      `[whatsapp:mock-text] session=${args.sessionId ?? "none"} to=${args.to} :: ${args.body}`,
    );
    return { ok: true, mocked: true };
  }

  const res = await openwaFetch<{ messageId?: string; timestamp?: number }>(
    creds,
    "POST",
    `/api/sessions/${args.sessionId}/messages/send-text`,
    { chatId: toChatId(args.to), text: args.body },
  );
  if (!res.ok) {
    console.error("[whatsapp] sendText failed", {
      to: args.to,
      sessionId: args.sessionId,
      err: res.error,
    });
    return { ok: false, error: res.error };
  }
  return { ok: true, messageId: res.data.messageId };
}

/**
 * Send a voice/audio message via OpenWA. Replaces the Meta Cloud API
 * two-step "upload media → reference media_id" flow: OpenWA accepts the
 * media inline as base64, so callers hand us the buffer directly.
 */
export async function sendAudio(args: {
  to: string;
  sessionId?: string | null;
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}): Promise<{ ok: true; messageId?: string; mocked?: boolean } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds || !args.sessionId) {
    console.log(
      `[whatsapp:mock-audio] session=${args.sessionId ?? "none"} to=${args.to} ${args.mimetype} ${args.buffer.length}b`,
    );
    return { ok: true, mocked: true };
  }

  const res = await openwaFetch<{ messageId?: string; timestamp?: number }>(
    creds,
    "POST",
    `/api/sessions/${args.sessionId}/messages/send-audio`,
    {
      chatId: toChatId(args.to),
      base64: args.buffer.toString("base64"),
      mimetype: args.mimetype,
      filename: args.filename ?? "voice.ogg",
    },
  );
  if (!res.ok) {
    console.error("[whatsapp] sendAudio failed", {
      to: args.to,
      sessionId: args.sessionId,
      err: res.error,
    });
    return { ok: false, error: res.error };
  }
  return { ok: true, messageId: res.data.messageId };
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verifies OpenWA's `X-OpenWA-Signature: sha256=<hex>` header against
 * the raw request body using HMAC-SHA256 with `OPENWA_WEBHOOK_SECRET`.
 *
 * SECURITY: in production the secret MUST be set. If it's missing we
 * refuse the webhook outright — otherwise a mis-configured deploy
 * silently accepts forged messages and lets anyone create appointments
 * or trigger billing actions. In dev (NODE_ENV !== "production") we
 * accept everything so local testing without the secret works.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
): boolean {
  const secret = env.OPENWA_WEBHOOK_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      console.error("[whatsapp] CRITICAL: OPENWA_WEBHOOK_SECRET missing in prod — rejecting");
      return false;
    }
    return true; // dev only
  }
  if (!header || !header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Inbound webhook payload parsers ─────────────────────────────────────────

interface OpenWaWebhookEnvelope {
  event?: string;
  timestamp?: string;
  sessionId?: string;
  idempotencyKey?: string;
  data?: OpenWaMessageData;
}

interface OpenWaMessageData {
  id?: string;
  from?: string;
  to?: string;
  chatId?: string;
  body?: string;
  type?: string;
  timestamp?: number;
  fromMe?: boolean;
  isGroup?: boolean;
  media?: {
    mimetype?: string;
    filename?: string | null;
    data?: string; // base64
  };
}

function asEnvelope(body: unknown): OpenWaWebhookEnvelope | null {
  if (!body || typeof body !== "object") return null;
  return body as OpenWaWebhookEnvelope;
}

/**
 * Inbound text messages from the patient. Group messages and
 * owner-mobile echoes are filtered out — those go through
 * `parseOwnerOutboundMessages`.
 */
export function parseTextMessages(
  body: unknown,
): Array<{ from: string; body: string; messageId: string; sessionId: string }> {
  const env = asEnvelope(body);
  if (!env || env.event !== "message.received") return [];
  const d = env.data;
  if (!d) return [];
  // `chat` is whatsapp-web.js's name for plain text — `text` is the
  // Cloud API name. Accept both so callers stay portable.
  if ((d.type !== "chat" && d.type !== "text") || !d.from || !d.id || !d.body) {
    return [];
  }
  if (d.fromMe) return [];
  if (d.isGroup) return [];
  return [
    {
      from: chatIdToPhone(d.from),
      body: d.body,
      messageId: d.id,
      sessionId: env.sessionId ?? "",
    },
  ];
}

/**
 * Inbound voice notes / audio. OpenWA delivers the media inline as
 * base64 alongside the message so there is no separate download step —
 * the caller receives a ready-to-transcribe buffer.
 */
export function parseAudioMessages(
  body: unknown,
): Array<{
  from: string;
  buffer: Buffer;
  mimetype: string;
  messageId: string;
  sessionId: string;
}> {
  const env = asEnvelope(body);
  if (!env || env.event !== "message.received") return [];
  const d = env.data;
  if (!d) return [];
  // whatsapp-web.js uses `ptt` for push-to-talk voice notes; `audio` for
  // attached audio files. Cloud API used `voice` and `audio`. Accept all.
  if (d.type !== "voice" && d.type !== "audio" && d.type !== "ptt") return [];
  if (!d.from || !d.id || !d.media?.data) return [];
  if (d.fromMe) return [];
  if (d.isGroup) return [];
  return [
    {
      from: chatIdToPhone(d.from),
      buffer: Buffer.from(d.media.data, "base64"),
      mimetype: d.media.mimetype ?? "audio/ogg",
      messageId: d.id,
      sessionId: env.sessionId ?? "",
    },
  ];
}

/**
 * Coexistence-style detection — messages the cabinet owner wrote from
 * their mobile WhatsApp Business app, echoed back to us by OpenWA so we
 * can keep the AIConversation history in sync and mute the bot for the
 * suppression window.
 *
 * With OpenWA this is trivial: the `fromMe` flag is set natively (vs the
 * Cloud API which required comparing `display_phone_number` against
 * `from`). Group messages are excluded — owner replies in a group chat
 * are not patient conversations and shouldn't trigger handoff.
 */
export function parseOwnerOutboundMessages(
  body: unknown,
): Array<{
  patientPhone: string;
  body: string;
  messageId: string;
  sentAt: Date;
  sessionId: string;
}> {
  const env = asEnvelope(body);
  if (!env || env.event !== "message.received") return [];
  const d = env.data;
  if (!d || !d.fromMe || d.isGroup) return [];
  if ((d.type !== "chat" && d.type !== "text") || !d.to || !d.id || !d.body) {
    return [];
  }
  const sentAt = d.timestamp ? new Date(d.timestamp * 1000) : new Date();
  return [
    {
      patientPhone: chatIdToPhone(d.to),
      body: d.body,
      messageId: d.id,
      sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
      sessionId: env.sessionId ?? "",
    },
  ];
}

// ─── Session management (QR onboarding for /settings/ai-receptionist) ────────

export interface OpenWaSession {
  id: string;
  name: string;
  /// Engine-reported lifecycle. We treat `ready` and `authenticated`
  /// as "connected and able to send/receive". Everything else means
  /// "not yet ready" (the UI shows a QR or a retry button).
  status:
    | "created"
    | "initializing"
    | "qr_ready"
    | "authenticated"
    | "ready"
    | "disconnected"
    | "failed"
    | string;
  phone?: string | null;
  pushName?: string | null;
}

export async function openwaCreateSession(args: {
  name: string;
}): Promise<{ ok: true; session: OpenWaSession } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<OpenWaSession>(creds, "POST", "/api/sessions", {
    name: args.name,
    config: { autoReconnect: true },
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, session: res.data };
}

/**
 * List every session known to the gateway. Used by `startOpenwaConnection`
 * to recover when the clinic.openwaSessionId was lost (manual unlink,
 * DB rollback, etc.) but the OpenWA session still exists under the
 * cabinet's slug-derived name. Avoids dangling sessions and duplicate-
 * name errors.
 */
export async function openwaListSessions(): Promise<
  { ok: true; sessions: OpenWaSession[] } | { ok: false; error: string }
> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<OpenWaSession[]>(creds, "GET", "/api/sessions");
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, sessions: Array.isArray(res.data) ? res.data : [] };
}

export async function openwaStartSession(
  sessionId: string,
): Promise<{ ok: true; session: OpenWaSession } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<OpenWaSession>(
    creds,
    "POST",
    `/api/sessions/${sessionId}/start`,
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, session: res.data };
}

/**
 * Fetch the current QR code for a session. The QR is returned as a data
 * URL ready to drop into an `<img src=…>`. Returns `qrCode: null` when
 * the session is already connected (no QR needed) — the UI should then
 * show the connected state instead.
 */
export async function openwaGetQr(
  sessionId: string,
): Promise<
  | { ok: true; qrCode: string | null; status: OpenWaSession["status"] }
  | { ok: false; error: string }
> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<{ qrCode?: string; status: OpenWaSession["status"] }>(
    creds,
    "GET",
    `/api/sessions/${sessionId}/qr`,
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, qrCode: res.data.qrCode ?? null, status: res.data.status };
}

export async function openwaSessionStatus(
  sessionId: string,
): Promise<{ ok: true; session: OpenWaSession } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<OpenWaSession>(
    creds,
    "GET",
    `/api/sessions/${sessionId}`,
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, session: res.data };
}

/**
 * Register the inbound-message webhook for a session. Idempotent —
 * re-registering with the same URL just refreshes the secret. Returns
 * the webhook id so the caller can store it (e.g. to delete later).
 */
export async function openwaRegisterWebhook(args: {
  sessionId: string;
  url: string;
  secret: string;
}): Promise<{ ok: true; webhookId: string } | { ok: false; error: string }> {
  const creds = readCreds();
  if (!creds) return { ok: false, error: "OpenWA gateway not configured" };
  const res = await openwaFetch<{ id: string }>(
    creds,
    "POST",
    `/api/sessions/${args.sessionId}/webhooks`,
    {
      url: args.url,
      events: ["message.received"],
      secret: args.secret,
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, webhookId: res.data.id };
}
