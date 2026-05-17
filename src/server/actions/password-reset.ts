"use server";

import { randomBytes, createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { fail, ok, type Result } from "@/lib/utils/result";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

const requestSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const resetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, "PASSWORD_TOO_SHORT"),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a password-reset token for the given email.
 *
 * Always returns `ok` to prevent email enumeration: the caller never learns
 * whether the address exists. The email is only sent if a matching active user
 * is found.
 *
 * In dev (no RESEND_API_KEY), the reset link is logged to console.
 */
export async function requestPasswordResetAction(input: { email: string }): Promise<Result<null>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Email invalid");
  }

  // 3 attempts / hour / (IP + email). We return the SAME generic ok response
  // when blocked so the caller can't infer rate-limit state to enumerate
  // accounts; we just don't issue/send a new token.
  const ip = clientIp(await headers());
  const limit = await rateLimit("passwordReset", `${ip}:${parsed.data.email}`);
  if (!limit.success) return ok(null);

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      isActive: true,
      fullName: true,
      clinic: { select: { name: true } },
    },
  });

  if (user && user.isActive) {
    // Cryptographically random 32-byte token, URL-safe.
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl = env.NEXTAUTH_URL ?? "http://localhost:3000";
    const link = `${baseUrl}/fr/reset-password?token=${rawToken}`;

    // Fire-and-forget: a failed send must not leak the existence of the
    // account back to the caller. We log it for ops monitoring instead.
    const sendResult = await sendPasswordResetEmail({
      to: parsed.data.email,
      recipientName: user.fullName,
      resetLink: link,
      clinicName: user.clinic.name,
    });
    if (!sendResult.ok) {
      // eslint-disable-next-line no-console
      console.error("[password-reset] email send failed", {
        email: parsed.data.email,
        error: sendResult.error,
      });
    }
  }

  return ok(null);
}

/**
 * Consume a reset token and set a new password.
 *
 * Token is single-use: marked `usedAt` after success. Expired or already-used
 * tokens are rejected with `INVALID_TOKEN`.
 */
export async function resetPasswordAction(input: {
  token: string;
  password: string;
}): Promise<Result<null>> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((i) => i.path[0] === "password");
    if (passwordIssue) {
      return fail("PASSWORD_TOO_SHORT", passwordIssue.message);
    }
    return fail("INVALID_INPUT", "Invalid input");
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    return fail("INVALID_TOKEN", "Reset link invalid or expired");
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.$transaction([
    db.user.update({
      where: { id: record.user.id },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Optionally: invalidate other outstanding tokens for the same user.
    db.passwordResetToken.updateMany({
      where: { userId: record.user.id, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return ok(null);
}
