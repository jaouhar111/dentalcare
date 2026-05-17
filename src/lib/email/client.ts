/**
 * Transactional email client (Resend).
 *
 * # Operating modes
 *
 * Resend is optional in dev: when `RESEND_API_KEY` is unset, `sendEmail()`
 * logs to the console and returns `ok` — so reset-password / invoice flows
 * still work end-to-end locally without a real account.
 *
 * # Sender domain
 *
 * Before going to prod you MUST add and verify your sending domain in the
 * Resend dashboard (Settings → Domains → Add):
 *   - MX, SPF (TXT), DKIM (TXT × 3), DMARC (TXT) records added at your
 *     registrar (ANRT/Genious for `.ma`, Cloudflare/OVH otherwise).
 *   - `RESEND_FROM_EMAIL` must be `<anything>@<verified-domain>`.
 *
 * Until verification, `onboarding@resend.dev` is the only allowed sender
 * (Resend's sandbox; emails go through but only to your own inbox).
 *
 * # Error handling
 *
 * We return a `Result` rather than throwing so callers can decide whether a
 * failed email should bubble up (signup) or be best-effort (audit alerts).
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/utils/result";

let cached: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (cached) return cached;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

function fromAddress(): string {
  const email = env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const name = env.RESEND_FROM_NAME ?? "DentalCare";
  return `${name} <${email}>`;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  /// React Email component (preferred — renders to HTML + plaintext).
  react?: React.ReactElement;
  /// Raw HTML body (alternative to react).
  html?: string;
  /// Plaintext fallback for clients that don't render HTML.
  text?: string;
  /// Tags for Resend dashboard filtering ({category: "password-reset"} → searchable).
  tags?: { name: string; value: string }[];
  /// Reply-To override (e.g. clinic's contact email).
  replyTo?: string;
}

/**
 * Send a transactional email via Resend, or log to console in dev.
 *
 * Returns Result<id> — caller decides whether failure is fatal. In console-
 * mode the returned id is `dev-<timestamp>` so logs still contain a handle.
 */
export async function sendEmail(input: SendEmailInput): Promise<Result<{ id: string }>> {
  if (!getClient()) {
    // ─── Dev fallback ───
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 [email mock] to=${Array.isArray(input.to) ? input.to.join(",") : input.to}\n   subject="${input.subject}"\n   tags=${JSON.stringify(input.tags ?? [])}\n`,
    );
    return ok({ id: `dev-${Date.now()}` });
  }

  try {
    const client = getClient()!;
    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      react: input.react,
      html: input.html,
      text: input.text,
      tags: input.tags,
      replyTo: input.replyTo,
    } as Parameters<typeof client.emails.send>[0]);

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.error("[email] resend send failed", error);
      return fail("EMAIL_SEND_FAILED", error?.message ?? "Unknown error");
    }
    return ok({ id: data.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] resend threw", err);
    return fail("EMAIL_SEND_FAILED", err instanceof Error ? err.message : "Unknown error");
  }
}
