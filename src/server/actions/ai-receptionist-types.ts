import type { AIReceptionistStyle } from "@prisma/client";

/**
 * Five customisable response templates the cabinet can override. All
 * optional — when absent, the bot falls back to its built-in default
 * (which already speaks the cabinet's `defaultLocale`).
 *
 * Variables in `{{double-curlies}}` are interpolated by the engine
 * before being sent. Available everywhere:
 *   - {{clinicName}}, {{patientFirstName}}
 *
 * Per-template extras documented in DEFAULT_TEMPLATES below.
 */
export interface AITemplates {
  /** Reply when the patient asks to book — engine still picks the slots. */
  bookRdv?: string;
  /** Reply when an urgency keyword is detected ("mal", "douleur", "saigne"). */
  urgency?: string;
  /** Reply to "vous êtes ouverts ?" — engine appends the actual hours. */
  openingHours?: string;
  /** Reply when the patient asks for the address. */
  address?: string;
  /** Reply for anything off-topic ("livraison", "vendez du dentifrice ?"). */
  offTopic?: string;
}

/**
 * Read shape for the settings page — what `getAIReceptionistSettings`
 * returns. Tracks every field that the form needs to populate.
 */
export interface AIReceptionistSettings {
  enabled: boolean;
  style: AIReceptionistStyle;
  signature: string | null;
  templates: AITemplates;
}

/**
 * Write shape — what the form submits to `updateAIReceptionistSettings`.
 * All fields optional so a partial update (just toggling enabled,
 * just editing one template) sends a minimal payload.
 */
export interface UpdateAIReceptionistInput {
  enabled?: boolean;
  style?: AIReceptionistStyle;
  signature?: string | null;
  templates?: AITemplates;
}

/**
 * Built-in copy used when the cabinet hasn't customised a template.
 * Kept FR-first since 90 % of our cabinets are francophone; the
 * engine swaps to EN/DARIJA per the patient's detected locale.
 */
export const DEFAULT_TEMPLATES: Required<AITemplates> = {
  bookRdv:
    "Avec plaisir 🙂 Voici les créneaux disponibles ce {{dayLabel}} : {{slots}}. Lequel vous convient ?",
  urgency:
    "Je suis désolé que vous ayez mal. Je vous trouve le créneau d'urgence le plus proche.",
  openingHours:
    "Le cabinet {{clinicName}} est ouvert : {{hours}}. Voulez-vous prendre rendez-vous ?",
  address:
    "Le cabinet {{clinicName}} se trouve : {{address}}. À très vite.",
  offTopic:
    "Je ne peux vous aider que pour les rendez-vous et les questions sur le cabinet. Pour le reste, demandez à un humain au cabinet 🙏",
};
