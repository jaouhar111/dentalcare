/**
 * High-level transactional email senders.
 *
 * Each function corresponds to one product moment (password reset, invoice
 * receipt, etc.) and is responsible for picking the right template, subject,
 * and tags. Keep templates dumb (presentation only) and put any business
 * formatting (currency, dates) here.
 */

import { sendEmail } from "./client";
import { PasswordResetEmail } from "./templates/password-reset";
import { InvoiceReceiptEmail } from "./templates/invoice-receipt";
import { WelcomeEmail } from "./templates/welcome";
import { TrialExpiringEmail } from "./templates/trial-expiring";
import type { Result } from "@/lib/utils/result";

export async function sendPasswordResetEmail(input: {
  to: string;
  recipientName: string;
  resetLink: string;
  clinicName: string;
}): Promise<Result<{ id: string }>> {
  return sendEmail({
    to: input.to,
    subject: `Réinitialisation de votre mot de passe — ${input.clinicName}`,
    react: (
      <PasswordResetEmail
        recipientName={input.recipientName}
        resetLink={input.resetLink}
        clinicName={input.clinicName}
        validFor="30 minutes"
      />
    ),
    tags: [{ name: "category", value: "password-reset" }],
  });
}

/**
 * Welcome email — fires after a new cabinet completes the signup
 * action. Best-effort: signup itself succeeds even if the email send
 * fails (so a Resend outage doesn't break onboarding).
 */
export async function sendWelcomeEmail(input: {
  to: string;
  adminFirstName: string;
  clinicName: string;
  dashboardUrl: string;
  trialEndsAtLabel: string;
}): Promise<Result<{ id: string }>> {
  return sendEmail({
    to: input.to,
    subject: `Bienvenue sur DentalCare — ${input.clinicName}`,
    react: (
      <WelcomeEmail
        adminFirstName={input.adminFirstName}
        clinicName={input.clinicName}
        dashboardUrl={input.dashboardUrl}
        trialEndsAtLabel={input.trialEndsAtLabel}
      />
    ),
    tags: [{ name: "category", value: "welcome" }],
  });
}

/**
 * Trial-expiring nag. The Inngest cron fires this at D-3, D-1 and D-0
 * (3, 1 and 0 days before `trialEndsAt`). The action keeps the email
 * idempotent on its end via an audit-log lookup so a cron re-run never
 * triple-sends.
 */
export async function sendTrialExpiringEmail(input: {
  to: string;
  adminFirstName: string;
  clinicName: string;
  daysLeft: number;
  trialEndsAtLabel: string;
  upgradeUrl: string;
}): Promise<Result<{ id: string }>> {
  return sendEmail({
    to: input.to,
    subject:
      input.daysLeft <= 1
        ? `Votre essai DentalCare se termine demain — ${input.clinicName}`
        : `Votre essai DentalCare se termine dans ${input.daysLeft} jours`,
    react: (
      <TrialExpiringEmail
        adminFirstName={input.adminFirstName}
        clinicName={input.clinicName}
        daysLeft={input.daysLeft}
        trialEndsAtLabel={input.trialEndsAtLabel}
        upgradeUrl={input.upgradeUrl}
      />
    ),
    tags: [
      { name: "category", value: "trial-expiring" },
      { name: "daysLeft", value: String(input.daysLeft) },
    ],
  });
}

export async function sendInvoiceReceiptEmail(input: {
  to: string;
  patientName: string;
  invoiceNumber: string;
  amount: string;
  issueDate: string;
  pdfUrl: string;
  clinicName: string;
}): Promise<Result<{ id: string }>> {
  return sendEmail({
    to: input.to,
    subject: `Votre facture ${input.invoiceNumber} — ${input.clinicName}`,
    react: (
      <InvoiceReceiptEmail
        patientName={input.patientName}
        invoiceNumber={input.invoiceNumber}
        amount={input.amount}
        issueDate={input.issueDate}
        pdfUrl={input.pdfUrl}
        clinicName={input.clinicName}
      />
    ),
    tags: [
      { name: "category", value: "invoice-receipt" },
      { name: "invoice", value: input.invoiceNumber },
    ],
  });
}
