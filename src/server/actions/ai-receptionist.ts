"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIReceptionistStyle, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import type {
  AIReceptionistSettings,
  AITemplates,
  UpdateAIReceptionistInput,
} from "./ai-receptionist-types";

/**
 * Per-template field validation. Each field is optional, trimmed,
 * and capped at 500 chars — enough for a paragraph, not enough to
 * abuse the WhatsApp 1024-char outbound limit when variables
 * substitute in.
 */
const templatesSchema = z.object({
  bookRdv: z.string().trim().max(500).optional(),
  urgency: z.string().trim().max(500).optional(),
  openingHours: z.string().trim().max(500).optional(),
  address: z.string().trim().max(500).optional(),
  offTopic: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  style: z.enum(AIReceptionistStyle).optional(),
  signature: z.string().trim().max(80).nullable().optional(),
  templates: templatesSchema.optional(),
});

/**
 * Reads the cabinet's AI Receptionist settings.
 *
 * The `templatesJson` column is `Json?` in Prisma; we cast it to
 * `AITemplates` here so the page form never has to deal with `any`.
 * An empty object (no overrides) is returned when the column is null
 * — keeps the form simple: every input is always a string.
 */
export async function getAIReceptionistSettings(): Promise<
  Result<AIReceptionistSettings>
> {
  const me = await requireRole([UserRole.ADMIN]);
  const c = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: {
      aiEnabled: true,
      aiStyle: true,
      aiSignature: true,
      aiTemplatesJson: true,
    },
  });
  if (!c) return fail("NOT_FOUND", "Cabinet introuvable");

  const templates: AITemplates =
    (c.aiTemplatesJson as AITemplates | null) ?? {};

  return ok({
    enabled: c.aiEnabled,
    style: c.aiStyle,
    signature: c.aiSignature,
    templates,
  });
}

/**
 * Writes the AI Receptionist settings — admin-only.
 *
 * Behaviour:
 *   - Empty-string template fields are stored as `undefined` (i.e.
 *     the cabinet "cleared" their override → engine reverts to the
 *     built-in default).
 *   - Toggling `enabled = false` is the kill switch: the webhook
 *     handler will skip the AI engine and emit a "transferring you"
 *     fallback (Stage 1.bis).
 *   - Every change is audited so the super-admin can see who turned
 *     the bot off when a cabinet calls in confused.
 */
export async function updateAIReceptionistSettings(
  raw: UpdateAIReceptionistInput,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "INVALID_INPUT",
      "Réglages invalides",
      parsed.error.flatten().fieldErrors,
    );
  }
  const data = parsed.data;

  // Normalise empty strings → undefined so we don't store "" overrides
  // that look like a valid customisation but mean "use default".
  let normalisedTemplates: AITemplates | undefined;
  if (data.templates) {
    normalisedTemplates = {};
    for (const [key, value] of Object.entries(data.templates)) {
      if (value && value.length > 0) {
        normalisedTemplates[key as keyof AITemplates] = value;
      }
    }
  }

  // Capture before-state for the audit trail.
  const before = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: {
      aiEnabled: true,
      aiStyle: true,
      aiSignature: true,
    },
  });
  if (!before) return fail("NOT_FOUND", "Cabinet introuvable");

  await db.clinic.update({
    where: { id: me.clinicId },
    data: {
      ...(data.enabled !== undefined ? { aiEnabled: data.enabled } : {}),
      ...(data.style !== undefined ? { aiStyle: data.style } : {}),
      ...(data.signature !== undefined ? { aiSignature: data.signature || null } : {}),
      ...(normalisedTemplates !== undefined
        ? { aiTemplatesJson: normalisedTemplates }
        : {}),
    },
  });

  // Audit the toggle distinctly from style/template changes — the
  // ON/OFF transition is the one that genuinely changes how the bot
  // behaves on the next inbound message.
  if (data.enabled !== undefined && data.enabled !== before.aiEnabled) {
    await audit({
      clinicId: me.clinicId,
      userId: me.id,
      action: data.enabled
        ? "ai_receptionist.enabled"
        : "ai_receptionist.disabled",
      entity: "Clinic",
      entityId: me.clinicId,
      payload: { from: before.aiEnabled, to: data.enabled },
    });
  } else {
    await audit({
      clinicId: me.clinicId,
      userId: me.id,
      action: "ai_receptionist.settings_updated",
      entity: "Clinic",
      entityId: me.clinicId,
      payload: {
        style: data.style ?? null,
        signatureChanged: data.signature !== undefined,
        templatesChanged: normalisedTemplates !== undefined,
      },
    });
  }

  revalidatePath("/settings/ai-receptionist");
  revalidatePath("/settings");
  return ok({ id: me.clinicId });
}
