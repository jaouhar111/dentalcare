import { db } from "@/lib/db/client";

interface AuditInput {
  clinicId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "tokenHash",
  "token",
  "creditCard",
  "ssn",
]);

function scrub(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
}

/**
 * Record a mutation in the audit log.
 *
 * Best-effort: failures are logged but never throw, so the calling
 * Server Action's main result is preserved.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        clinicId: input.clinicId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        payloadJson: input.payload === undefined ? undefined : (scrub(input.payload) as never),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write entry", { input, err });
  }
}
