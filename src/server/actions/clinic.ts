"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import { updateClinicSchema, type UpdateClinicInput } from "@/server/schemas/clinic";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const ADMIN_ONLY = [UserRole.ADMIN] as const;

function zodFieldsFromError(error: unknown): Record<string, string[]> {
  if (!(error instanceof Object) || !("issues" in error)) return {};
  const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

export async function getClinic() {
  const me = await requireRole([...ANY_STAFF]);
  return db.clinic.findUnique({
    where: { id: me.clinicId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      vatNumber: true,
      defaultLocale: true,
      invoiceStartingNumber: true,
    },
  });
}

export async function updateClinic(raw: UpdateClinicInput): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ADMIN_ONLY]);
  const parsed = updateClinicSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid clinic data", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;
  await db.clinic.update({
    where: { id: me.clinicId },
    data: {
      name: data.name,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      vatNumber: data.vatNumber ?? null,
      defaultLocale: data.defaultLocale,
    },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "update",
    entity: "Clinic",
    entityId: me.clinicId,
  });
  revalidatePath("/[locale]/settings", "page");
  return ok({ id: me.clinicId });
}
