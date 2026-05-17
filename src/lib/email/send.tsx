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
