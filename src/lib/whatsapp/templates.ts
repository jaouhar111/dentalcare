/**
 * Definitions of the 4 WhatsApp Business templates we use.
 *
 * Each template is declared once with its parameter list — the sender (`sendTemplate`)
 * type-checks call sites against this shape. Adding a 5th template is a 3-line change.
 *
 * The text content lives in `docs/whatsapp-templates.md` and is submitted to Meta
 * Business Manager for pre-approval (catégorie UTILITY).
 *
 * Q7 status: 12 templates (4 × 3 langues) drafted in the doc. Submit them via
 * Meta Business Manager → WhatsApp Manager → Templates de message → Créer.
 */

import type { Locale } from "@/i18n/routing";

export type WhatsAppLocale = Extract<Locale, "fr" | "en">;

/**
 * Maps app locale → Meta language code. ISO 639 codes are used as-is.
 */
export const META_LANGUAGE_CODE: Record<WhatsAppLocale, string> = {
  fr: "fr",
  en: "en",
};

export type TemplateName =
  | "appointment_reminder"
  | "waitlist_slot_offered"
  | "checkup_reminder"
  | "payment_due";

export interface TemplateSpec<P extends Record<string, string>> {
  name: TemplateName;
  /** Order of body parameter substitution `{{1}}`, `{{2}}`, … */
  params: ReadonlyArray<keyof P>;
  /** Quick-reply button payloads (sent back by Meta on click). */
  buttons?: ReadonlyArray<{ kind: "quick_reply" | "url"; payload: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template specs (types only — text content is on Meta's side after approval)
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentReminderParams extends Record<string, string> {
  patientFirstName: string;
  date: string;
  time: string;
  dentistName: string;
  clinicName: string;
}

export const APPOINTMENT_REMINDER: TemplateSpec<AppointmentReminderParams> = {
  name: "appointment_reminder",
  params: ["patientFirstName", "date", "time", "dentistName", "clinicName"],
  buttons: [
    { kind: "quick_reply", payload: "confirm_attendance" },
    { kind: "quick_reply", payload: "request_reschedule" },
  ],
};

export interface WaitlistSlotOfferedParams extends Record<string, string> {
  patientFirstName: string;
  date: string;
  time: string;
  dentistName: string;
  clinicName: string;
  expiresIn: string;
}

export const WAITLIST_SLOT_OFFERED: TemplateSpec<WaitlistSlotOfferedParams> = {
  name: "waitlist_slot_offered",
  params: ["patientFirstName", "date", "time", "dentistName", "clinicName", "expiresIn"],
  buttons: [
    { kind: "quick_reply", payload: "accept_waitlist_slot" },
    { kind: "quick_reply", payload: "decline_waitlist_slot" },
  ],
};

export interface CheckupReminderParams extends Record<string, string> {
  patientFirstName: string;
  checkupType: string;
  sinceLast: string;
  clinicName: string;
  clinicPhone: string;
}

export const CHECKUP_REMINDER: TemplateSpec<CheckupReminderParams> = {
  name: "checkup_reminder",
  params: ["patientFirstName", "checkupType", "sinceLast", "clinicName", "clinicPhone"],
  buttons: [
    { kind: "url", payload: "book_appointment" },
    { kind: "quick_reply", payload: "remind_later" },
  ],
};

export interface PaymentDueParams extends Record<string, string> {
  patientFirstName: string;
  amount: string;
  dueDate: string;
  installment: string;
  invoiceNumber: string;
  clinicName: string;
}

export const PAYMENT_DUE: TemplateSpec<PaymentDueParams> = {
  name: "payment_due",
  params: ["patientFirstName", "amount", "dueDate", "installment", "invoiceNumber", "clinicName"],
  buttons: [
    { kind: "url", payload: "view_invoice" },
    { kind: "quick_reply", payload: "mark_paid_acknowledged" },
  ],
};

export const ALL_TEMPLATES = {
  appointment_reminder: APPOINTMENT_REMINDER,
  waitlist_slot_offered: WAITLIST_SLOT_OFFERED,
  checkup_reminder: CHECKUP_REMINDER,
  payment_due: PAYMENT_DUE,
} as const;
