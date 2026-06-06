/**
 * Outbound WhatsApp message builders for the 4 transactional flows.
 *
 * History: under Meta Cloud API these were named "templates" because Meta
 * required them to be pre-approved with parameter placeholders. With the
 * OpenWA gateway (self-hosted whatsapp-web.js), there is no template
 * concept — every message is a free-form text. We keep the filename for
 * import-path compatibility but the symbols are plain text builders now.
 *
 * Quick-reply buttons (the Cloud API offered "Confirm" / "Reschedule"
 * native buttons) are not reliably rendered by consumer WhatsApp when
 * sent via web.js. The body texts therefore end with an explicit
 * instruction ("répondez OUI pour confirmer") and the AI engine picks
 * up the patient's free-text reply naturally — usually a richer flow
 * anyway because the bot can disambiguate, reschedule mid-conversation,
 * etc.
 *
 * URL buttons (book appointment / view invoice) are inlined as plain
 * URLs in the body — WhatsApp auto-links them.
 */

import type { Locale } from "@/i18n/routing";

/// Subset of app locales for which we have a hand-translated copy.
/// Add `"ar"` here (and the matching case branch in each builder) the day
/// the wider app turns on Arabic.
export type WhatsAppLocale = Extract<Locale, "fr" | "en">;

function pickLocale(input: string | null | undefined): WhatsAppLocale {
  return input === "en" ? "en" : "fr";
}

// ────────────────────────────────────────────────────────────────────────
// 1. Appointment reminder (J-1)
// ────────────────────────────────────────────────────────────────────────

export interface AppointmentReminderInput {
  patientFirstName: string;
  date: string;
  time: string;
  dentistName: string;
  clinicName: string;
  locale?: string | null;
}

export function buildAppointmentReminder(input: AppointmentReminderInput): string {
  const { patientFirstName: p, date, time, dentistName: d, clinicName: c } = input;
  switch (pickLocale(input.locale)) {
    case "en":
      return [
        `Hello ${p} 👋`,
        ``,
        `This is a reminder of your appointment at ${c}:`,
        ``,
        `📅 ${date} at ${time}`,
        `👩‍⚕️ ${d}`,
        ``,
        `Please reply YES to confirm or NO to ask for a reschedule.`,
        ``,
        `${c} — Thank you for your trust`,
      ].join("\n");
    case "fr":
    default:
      return [
        `Bonjour ${p} 👋`,
        ``,
        `Nous vous rappelons votre rendez-vous au cabinet ${c} :`,
        ``,
        `📅 ${date} à ${time}`,
        `👩‍⚕️ ${d}`,
        ``,
        `Répondez OUI pour confirmer ou REPORTER pour demander un autre créneau.`,
        ``,
        `${c} — Merci de votre confiance`,
      ].join("\n");
  }
}

// ────────────────────────────────────────────────────────────────────────
// 2. Waitlist slot offered
// ────────────────────────────────────────────────────────────────────────

export interface WaitlistSlotOfferedInput {
  patientFirstName: string;
  date: string;
  time: string;
  dentistName: string;
  clinicName: string;
  expiresIn: string;
  acceptUrl?: string;
  locale?: string | null;
}

export function buildWaitlistSlotOffered(input: WaitlistSlotOfferedInput): string {
  const { patientFirstName: p, date, time, dentistName: d, clinicName: c, expiresIn: exp } = input;
  const linkLine = input.acceptUrl ? `\n🔗 ${input.acceptUrl}\n` : "";
  switch (pickLocale(input.locale)) {
    case "en":
      return [
        `✨ A slot just opened`,
        ``,
        `Hello ${p} 👋`,
        ``,
        `Good news! A slot has just opened for you at ${c}:`,
        ``,
        `📅 ${date} at ${time}`,
        `👩‍⚕️ ${d}`,
        ``,
        `⏰ This offer expires in ${exp}. First to confirm gets the slot!`,
        linkLine,
        `Reply YES to accept.`,
        ``,
        c,
      ].join("\n");
    case "fr":
    default:
      return [
        `✨ Un créneau s'est libéré`,
        ``,
        `Bonjour ${p} 👋`,
        ``,
        `Bonne nouvelle ! Un créneau s'est libéré pour vous chez ${c} :`,
        ``,
        `📅 ${date} à ${time}`,
        `👩‍⚕️ ${d}`,
        ``,
        `⏰ Cette proposition expire dans ${exp}. Premier confirmé, premier servi !`,
        linkLine,
        `Répondez OUI pour accepter.`,
        ``,
        c,
      ].join("\n");
  }
}

// ────────────────────────────────────────────────────────────────────────
// 3. Checkup recall
// ────────────────────────────────────────────────────────────────────────

export interface CheckupReminderInput {
  patientFirstName: string;
  checkupType: string;
  sinceLast: string;
  clinicName: string;
  clinicPhone: string;
  bookingUrl?: string;
  locale?: string | null;
}

export function buildCheckupReminder(input: CheckupReminderInput): string {
  const { patientFirstName: p, checkupType: t, sinceLast: s, clinicName: c, clinicPhone: ph } = input;
  const linkLine = input.bookingUrl ? `\n🔗 ${input.bookingUrl}\n` : "";
  switch (pickLocale(input.locale)) {
    case "en":
      return [
        `🦷 Time to take care of your smile`,
        ``,
        `Hello ${p} 👋`,
        ``,
        `It has been ${s} since your last ${t}. To maintain good oral health, we recommend booking an appointment.`,
        ``,
        `${c} is available at ${ph} or via the link below.`,
        linkLine,
        `See you soon — ${c}`,
      ].join("\n");
    case "fr":
    default:
      return [
        `🦷 Il est temps de prendre soin de votre sourire`,
        ``,
        `Bonjour ${p} 👋`,
        ``,
        `Cela fait ${s} depuis votre dernier ${t}. Pour maintenir votre santé bucco-dentaire, nous vous recommandons de prendre rendez-vous.`,
        ``,
        `${c} reste à votre disposition au ${ph} ou via le lien ci-dessous.`,
        linkLine,
        `À très bientôt — ${c}`,
      ].join("\n");
  }
}

// ────────────────────────────────────────────────────────────────────────
// 4. Payment due
// ────────────────────────────────────────────────────────────────────────

export interface PaymentDueInput {
  patientFirstName: string;
  amount: string;
  dueDate: string;
  installment: string;
  invoiceNumber: string;
  clinicName: string;
  invoiceUrl?: string;
  locale?: string | null;
}

export function buildPaymentDue(input: PaymentDueInput): string {
  const { patientFirstName: p, amount: a, dueDate: dd, installment: ins, invoiceNumber: inv, clinicName: c } = input;
  const linkLine = input.invoiceUrl ? `\n🔗 ${input.invoiceUrl}\n` : "";
  switch (pickLocale(input.locale)) {
    case "en":
      return [
        `💳 Upcoming payment due`,
        ``,
        `Hello ${p} 👋`,
        ``,
        `An installment of your payment plan is coming up:`,
        ``,
        `💰 Amount: ${a}`,
        `📅 Due date: ${dd}`,
        `🔢 Installment ${ins}`,
        `📄 Invoice: ${inv}`,
        ``,
        `For payment or any question, please contact ${c}.`,
        linkLine,
        c,
      ].join("\n");
    case "fr":
    default:
      return [
        `💳 Échéance de paiement à venir`,
        ``,
        `Bonjour ${p} 👋`,
        ``,
        `Une échéance de votre plan de paiement arrive bientôt :`,
        ``,
        `💰 Montant : ${a}`,
        `📅 Échéance : ${dd}`,
        `🔢 Échéance ${ins}`,
        `📄 Facture : ${inv}`,
        ``,
        `Pour tout règlement ou question, contactez ${c}.`,
        linkLine,
        c,
      ].join("\n");
  }
}
