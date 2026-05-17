"use server";

import { InvoiceStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;

/**
 * Global Cmd-K search across patients, upcoming appointments, invoices and
 * stock. Runs all four sub-queries in parallel and returns ≤ 5 hits per group
 * so the palette stays scannable. Query must be ≥ 2 chars to avoid full-table
 * scans on every keystroke.
 *
 * NOTE: kept as a single server action (rather than 4 endpoints) so the
 * client only pays one network round-trip per keystroke.
 */
export async function globalSearch(query: string): Promise<{
  patients: Array<{ id: string; label: string; sublabel: string }>;
  appointments: Array<{ id: string; label: string; sublabel: string; patientId: string }>;
  invoices: Array<{ id: string; label: string; sublabel: string }>;
  stock: Array<{ id: string; label: string; sublabel: string }>;
}> {
  const user = await requireRole([...ANY_STAFF]);
  const q = query.trim();
  if (q.length < 2) {
    return { patients: [], appointments: [], invoices: [], stock: [] };
  }
  const like = q;

  const [patients, appointments, invoices, stock] = await Promise.all([
    db.patient.findMany({
      where: {
        clinicId: user.clinicId,
        deletedAt: null,
        OR: [
          { firstName: { contains: like, mode: "insensitive" } },
          { lastName: { contains: like, mode: "insensitive" } },
          { cin: { contains: like, mode: "insensitive" } },
          { phone: { contains: like } },
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, phone: true, cin: true },
    }),
    db.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startAt: { gte: new Date() },
        OR: [
          { reason: { contains: like, mode: "insensitive" } },
          {
            patient: {
              OR: [
                { firstName: { contains: like, mode: "insensitive" } },
                { lastName: { contains: like, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
      take: 5,
      orderBy: { startAt: "asc" },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        dentist: { select: { firstName: true, lastName: true } },
      },
    }),
    db.invoice.findMany({
      where: {
        clinicId: user.clinicId,
        status: { not: InvoiceStatus.DRAFT },
        OR: [
          { number: { contains: like, mode: "insensitive" } },
          {
            patient: {
              OR: [
                { firstName: { contains: like, mode: "insensitive" } },
                { lastName: { contains: like, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
      take: 5,
      orderBy: { emittedAt: "desc" },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
    db.stockItem.findMany({
      where: {
        clinicId: user.clinicId,
        isActive: true,
        OR: [
          { code: { contains: like, mode: "insensitive" } },
          { name: { contains: like, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, code: true, name: true, category: true },
    }),
  ]);

  return {
    patients: patients.map((p) => ({
      id: p.id,
      label: `${p.firstName} ${p.lastName}`,
      sublabel: p.cin ? `CIN ${p.cin} · ${p.phone}` : p.phone,
    })),
    appointments: appointments.map((a) => ({
      id: a.id,
      patientId: a.patient
        ? `${a.patient.firstName} ${a.patient.lastName}`
        : "—",
      label: `${a.patient.firstName} ${a.patient.lastName}${a.reason ? ` · ${a.reason}` : ""}`,
      sublabel: `${new Intl.DateTimeFormat("fr-MA", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(a.startAt)} · Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      label: i.number ?? `Brouillon · ${i.id.slice(-6)}`,
      sublabel: `${i.patient.firstName} ${i.patient.lastName} · ${Number(i.total).toFixed(2)} DH`,
    })),
    stock: stock.map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: `${s.code}${s.category ? ` · ${s.category}` : ""}`,
    })),
  };
}
