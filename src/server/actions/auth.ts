"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { Prisma, SubscriptionPlan, UserRole } from "@prisma/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut } from "@/lib/auth";
import { isAllowed } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/utils/result";
import { slugify } from "@/lib/utils/slug";

const loginSchema = z.object({
  email: z.string().email("INVALID_EMAIL").toLowerCase().trim(),
  password: z.string().min(1, "REQUIRED"),
});

type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(
  input: LoginInput,
  redirectTo = "/",
): Promise<Result<null, { code: string; message: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Email or password invalid");
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `${ip}:${parsed.data.email}`;
  const guard = isAllowed(rateKey);
  if (!guard.allowed) {
    return fail("RATE_LIMITED", "Too many attempts, try again later");
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      ip,
      redirectTo,
    });
    return ok(null);
  } catch (e) {
    if (isRedirectError(e)) {
      // signIn() throws a redirect on success; rethrow so Next handles it.
      throw e;
    }
    return fail("INVALID_CREDENTIALS", "Invalid email or password");
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

// ─────────────────────────────────────────────────────────────────────
// Self-service signup — Option B multi-tenant onboarding
// ─────────────────────────────────────────────────────────────────────

// New cabinets start on the free STARTER plan (10 patients) for a 30-day
// window, after which they must pick a paid plan to keep writing.
const TRIAL_DAYS = 30;

const signupSchema = z.object({
  clinicName: z
    .string()
    .min(2, "TOO_SHORT")
    .max(80, "TOO_LONG")
    .trim(),
  fullName: z
    .string()
    .min(2, "TOO_SHORT")
    .max(80, "TOO_LONG")
    .trim(),
  email: z.string().email("INVALID_EMAIL").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "PASSWORD_TOO_SHORT")
    .max(128, "PASSWORD_TOO_LONG"),
  phone: z.string().trim().optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Provisions a brand-new cabinet :
 *   1. Validate inputs (zod).
 *   2. Rate-limit per IP so we don't get spammed.
 *   3. Reject if the email is already on another clinic.
 *   4. Generate a unique slug from the cabinet name (e.g. "Cabinet
 *      Hdoud" → "cabinet-hdoud" then "cabinet-hdoud-2" on collision).
 *   5. Create Clinic + ADMIN User in one transaction so we never end
 *      up with an orphan clinic if the user insert fails.
 *   6. Stamp `trialEndsAt = now + 30 days` on the STARTER plan. After
 *      Stripe is wired the
 *      paywall will check this against `Date.now()`.
 *   7. Sign the new admin in immediately so they land on /dashboard.
 */
export async function signupAction(
  input: SignupInput,
): Promise<Result<{ redirectTo: string }, { code: string; message: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return fail(firstError?.message ?? "INVALID_INPUT", "Invalid sign-up data");
  }
  const data = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const guard = isAllowed(`signup:${ip}`);
  if (!guard.allowed) {
    return fail("RATE_LIMITED", "Trop de tentatives, réessayez plus tard.");
  }

  const existingUser = await db.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existingUser) {
    return fail("EMAIL_TAKEN", "Cette adresse est déjà liée à un compte.");
  }

  // Compute a unique slug. We try up to 20 variants — beyond that it
  // means a thousand cabinets share the same base name, time to escalate.
  let slug = slugify(data.clinicName);
  for (let suffix = 2; suffix <= 20; suffix++) {
    const taken = await db.clinic.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) break;
    slug = `${slugify(data.clinicName)}-${suffix}`;
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  const passwordHash = await hashPassword(data.password);

  try {
    const created = await db.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: data.clinicName,
          slug,
          phone: data.phone ?? null,
          email: data.email,
          defaultLocale: data.locale,
          // Random 4-digit start so the first invoice number isn't a
          // dead giveaway of "we're a brand-new cabinet, you're the
          // first patient".
          invoiceStartingNumber: 1000 + Math.floor(Math.random() * 9000),
          // Free entry tier; the 30-day window is enforced via trialEndsAt.
          plan: SubscriptionPlan.STARTER,
          trialEndsAt,
        },
        select: { id: true, slug: true, name: true },
      });
      await tx.user.create({
        data: {
          clinicId: clinic.id,
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          role: UserRole.ADMIN,
        },
      });
      return clinic;
    });

    await audit({
      clinicId: created.id,
      action: "clinic.signup",
      entity: "Clinic",
      entityId: created.id,
      payload: { slug: created.slug, name: created.name, ip },
    });

    // Best-effort welcome email — the signup itself already succeeded,
    // so a Resend outage / dev-mode mock just logs and moves on. The
    // recipient is the new admin; the deep link drops them on /dashboard
    // (they're already signed in), where they can finish setup from
    // Paramètres.
    const baseUrl = env.NEXTAUTH_URL ?? "http://localhost:3000";
    const adminFirstName = data.fullName.split(" ")[0] ?? data.fullName;
    const trialEndsAtLabel = trialEndsAt.toLocaleDateString(data.locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    void sendWelcomeEmail({
      to: data.email,
      adminFirstName,
      clinicName: data.clinicName,
      dashboardUrl: `${baseUrl}/${data.locale}/dashboard`,
      trialEndsAtLabel,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[signup] welcome email failed", err);
    });

    return ok({ redirectTo: `/login?email=${encodeURIComponent(data.email)}&signup=success` });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("EMAIL_TAKEN", "Cette adresse est déjà liée à un compte.");
    }
    console.error("[signup] unexpected error", e);
    return fail(
      "UNEXPECTED",
      e instanceof Error ? `Erreur : ${e.message}` : "Une erreur est survenue, réessayez.",
    );
  }
}
