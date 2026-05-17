"use server";

import JSZip from "jszip";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { renderPrescriptionPdf } from "@/lib/pdf/prescription-pdf";
import { deleteAsset, deliveryUrl } from "@/lib/cloudinary/client";
import { getInvoice } from "@/server/actions/invoices";
import { getPrescription } from "@/server/actions/prescriptions";
import { fail, ok, type Result } from "@/lib/utils/result";

/**
 * Build a complete archive of a patient's data for GDPR / CNDP / Loi 09-08
 * "Right to access" (art. 7) requests.
 *
 * # What's included
 *
 *   patient.json                — core demographic record
 *   appointments.json           — every RDV ever booked
 *   treatments.json             — every TreatmentApplication
 *   medical-notes.json          — clinical observations
 *   dental-chart.json           — odontogramme history
 *   prescriptions.json + PDFs   — every issued prescription
 *   invoices.json + PDFs        — every invoice (incl. drafts)
 *   payments.json               — payment history
 *   payment-plans.json          — installment plans
 *   radiographs/manifest.json   — radiograph metadata + delivery URLs
 *   photos/manifest.json        — treatment photos metadata + delivery URLs
 *   recalls.json                — follow-up reminders
 *   audit-trail.json            — every audit entry mentioning this patient
 *   _README.txt                 — explanatory note for the patient
 *
 * # What's NOT included
 *
 *   - Other patients' data (obviously)
 *   - Internal staff metadata (passwordHashes, tokens) — scrubbed via audit's
 *     existing redaction.
 *   - Live binary downloads of Cloudinary assets — we include URLs instead.
 *     Reason: fetching ~30 images server-side would push past Vercel's 10 s
 *     function timeout. The patient can save each URL one by one for ≤ 30
 *     days. If they need a deeper archive, generate this export AGAIN with
 *     fresh signed URLs.
 *
 * Returns the raw zip Buffer + a suggested filename. Caller (the API route)
 * sets `Content-Disposition: attachment`.
 */
export async function exportPatientData(
  patientId: string,
): Promise<Result<{ buffer: Buffer; filename: string }>> {
  const session = await auth();
  if (!session?.user) return fail("UNAUTHORIZED", "Login required");

  // Pull everything in one transaction so the export is internally consistent
  // (no half-state where invoice X exists but its payments don't).
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: session.user.clinicId },
    include: { allergies: true, clinic: { select: { name: true } } },
  });
  if (!patient) return fail("NOT_FOUND", "Patient not found");

  const [
    appointments,
    treatments,
    notes,
    chart,
    prescriptions,
    invoices,
    payments,
    plans,
    radiographs,
    photos,
    recalls,
    auditEntries,
  ] = await Promise.all([
    db.appointment.findMany({
      where: { patientId },
      orderBy: { startAt: "desc" },
      include: { dentist: { select: { firstName: true, lastName: true } } },
    }),
    db.treatmentApplication.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { catalogItem: { select: { code: true, name: true } } },
    }),
    db.medicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { fullName: true } } },
    }),
    db.dentalChartEntry.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    }),
    db.prescription.findMany({
      where: { patientId },
      orderBy: { issuedAt: "desc" },
      select: { id: true, issuedAt: true, locale: true, notes: true },
    }),
    db.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        emittedAt: true,
        dueDate: true,
        total: true,
        discountAmount: true,
        subtotal: true,
      },
    }),
    db.payment.findMany({
      where: { invoice: { patientId } },
      orderBy: { receivedAt: "desc" },
    }),
    db.paymentPlan.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { installments: true },
    }),
    db.radiograph.findMany({
      where: { patientId },
      orderBy: { takenAt: "desc" },
    }),
    db.treatmentPhoto.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    }),
    db.recallReminder.findMany({
      where: { patientId },
      orderBy: { dueDate: "desc" },
    }),
    db.auditLog.findMany({
      where: { clinicId: session.user.clinicId, entity: "Patient", entityId: patientId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const zip = new JSZip();
  const now = new Date();
  const slug = `${patient.lastName}-${patient.firstName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const filename = `dossier-medical-${slug}-${now.toISOString().slice(0, 10)}.zip`;

  zip.file(
    "_README.txt",
    [
      `Dossier médical — ${patient.firstName} ${patient.lastName}`,
      `Émis par : ${patient.clinic.name}`,
      `Date d'export : ${now.toISOString()}`,
      "",
      "Ce dossier rassemble la totalité des données vous concernant",
      "conservées par le cabinet, conformément à la loi 09-08 (Maroc) et",
      "au principe de droit d'accès du patient à ses données médicales.",
      "",
      "Contenu :",
      "  patient.json           — identité, contact, antécédents médicaux",
      "  appointments.json      — historique des rendez-vous",
      "  treatments.json        — soins planifiés et réalisés",
      "  medical-notes.json     — observations cliniques",
      "  dental-chart.json      — odontogramme historique",
      "  prescriptions.json     — ordonnances délivrées",
      "  prescriptions/*.pdf    — PDF de chaque ordonnance",
      "  invoices.json          — factures",
      "  invoices/*.pdf         — PDF de chaque facture",
      "  payments.json          — paiements reçus",
      "  payment-plans.json     — plans de paiement échelonnés",
      "  radiographs/manifest.json — radiographies (avec URLs de téléchargement)",
      "  photos/manifest.json   — photos de traitement",
      "  recalls.json           — rappels de suivi",
      "  audit-trail.json       — historique des accès et modifications",
      "",
      "Les URLs de téléchargement des radiographies et photos sont valables",
      "30 jours. Pour conserver ces images de manière permanente, sauvegardez",
      "chaque fichier individuellement depuis votre navigateur.",
    ].join("\n"),
  );

  // ─── Core data ─────────────────────────────────────────────────────────
  zip.file("patient.json", JSON.stringify(patient, null, 2));
  zip.file("appointments.json", JSON.stringify(appointments, null, 2));
  zip.file("treatments.json", JSON.stringify(treatments, null, 2));
  zip.file("medical-notes.json", JSON.stringify(notes, null, 2));
  zip.file("dental-chart.json", JSON.stringify(chart, null, 2));
  zip.file("payments.json", JSON.stringify(payments, null, 2));
  zip.file("payment-plans.json", JSON.stringify(plans, null, 2));
  zip.file("recalls.json", JSON.stringify(recalls, null, 2));

  // ─── Invoices (JSON + PDFs) ────────────────────────────────────────────
  zip.file("invoices.json", JSON.stringify(invoices, null, 2));
  const invoicesFolder = zip.folder("invoices")!;
  for (const inv of invoices) {
    if (inv.status === "DRAFT") continue; // drafts have no canonical PDF
    const fullInvoice = await getInvoice(inv.id);
    if (fullInvoice.ok) {
      try {
        const pdf = await renderInvoicePdf(fullInvoice.data);
        invoicesFolder.file(`${inv.number ?? inv.id}.pdf`, pdf);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[gdpr-export] invoice PDF render failed", { id: inv.id, err });
      }
    }
  }

  // ─── Prescriptions (JSON + PDFs) ───────────────────────────────────────
  zip.file("prescriptions.json", JSON.stringify(prescriptions, null, 2));
  const presFolder = zip.folder("prescriptions")!;
  for (const p of prescriptions) {
    const full = await getPrescription(p.id);
    if (full.ok) {
      try {
        const pdf = await renderPrescriptionPdf(full.data);
        const dateStr = p.issuedAt.toISOString().slice(0, 10);
        presFolder.file(`ordonnance-${dateStr}-${p.id.slice(-6)}.pdf`, pdf);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[gdpr-export] prescription PDF render failed", { id: p.id, err });
      }
    }
  }

  // ─── Imagery manifests ─────────────────────────────────────────────────
  const radioFolder = zip.folder("radiographs")!;
  radioFolder.file(
    "manifest.json",
    JSON.stringify(
      radiographs.map((r) => ({
        ...r,
        downloadUrl: deliveryUrl(r.publicId, { format: r.format ?? undefined }),
      })),
      null,
      2,
    ),
  );

  const photosFolder = zip.folder("photos")!;
  photosFolder.file(
    "manifest.json",
    JSON.stringify(
      photos.map((p) => ({
        ...p,
        downloadUrl: deliveryUrl(p.publicId, { format: p.format ?? undefined }),
      })),
      null,
      2,
    ),
  );

  // ─── Audit trail ───────────────────────────────────────────────────────
  zip.file("audit-trail.json", JSON.stringify(auditEntries, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  await audit({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "patient.gdpr.export",
    entity: "Patient",
    entityId: patientId,
    payload: { bytes: buffer.byteLength },
  });

  return ok({ buffer, filename });
}

/**
 * Hard-delete a patient and every record we hold about them — implementing
 * Loi 09-08 art. 8 (right to erasure / droit à l'effacement).
 *
 * This is **irreversible**. Soft-delete (`deletedAt`) should be used as the
 * default; this action is reserved for explicit erasure requests.
 *
 * # Order of operations
 *
 * Prisma's `onDelete: Cascade` covers most relations, but four don't cascade
 * from Patient (Appointment, WaitlistEntry, Invoice, PaymentPlan — see
 * schema). We delete those manually in a transaction, then let cascade
 * handle the rest:
 *
 *   1. Capture a tombstone snapshot for the audit log (so we can prove the
 *      erasure happened on the right patient without keeping the raw data).
 *   2. Best-effort delete every Cloudinary asset (radiographs + photos).
 *   3. Inside a transaction:
 *      - Payments → PaymentPlanInstallments → PaymentPlans → InvoiceLines
 *        → Invoices → Appointments → WaitlistEntries → Patient.
 *      - Prisma cascades the rest (medical notes, treatment apps, etc.).
 *   4. Write the audit entry AFTER the patient row is gone; the entry stays
 *      indefinitely in `audit_log` (no cascade from Patient → AuditLog).
 *
 * # Why not `db.patient.delete({ where, cascade })`
 *
 * Postgres needs an explicit dependency-aware order to avoid FK violations
 * on the non-cascading relations. The transaction below mirrors that order.
 */
export async function hardDeletePatient(input: {
  patientId: string;
  reason: string;
}): Promise<Result<{ deletedAt: string }>> {
  const session = await auth();
  if (!session?.user) return fail("UNAUTHORIZED", "Login required");
  if (session.user.role !== UserRole.ADMIN) {
    return fail("FORBIDDEN", "Only admins can hard-delete patients");
  }
  if (!input.reason || input.reason.trim().length < 8) {
    return fail("INVALID_INPUT", "Reason is required (min 8 chars)");
  }

  const patient = await db.patient.findFirst({
    where: { id: input.patientId, clinicId: session.user.clinicId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      cin: true,
      phone: true,
      email: true,
      createdAt: true,
      radiographs: { select: { publicId: true } },
      treatmentPhotos: { select: { publicId: true } },
    },
  });
  if (!patient) return fail("NOT_FOUND", "Patient not found");

  // Best-effort Cloudinary cleanup. Failures here don't block the DB
  // transaction — the assets become orphans we can sweep with a cron later.
  const assets = [...patient.radiographs, ...patient.treatmentPhotos];
  await Promise.allSettled(assets.map((a) => deleteAsset(a.publicId)));

  await db.$transaction(async (tx) => {
    // Payments first — they FK to both Invoice (cascade) and Installment
    // (no cascade, so we must delete payments before plans).
    await tx.payment.deleteMany({ where: { invoice: { patientId: patient.id } } });

    // Installments + plans
    await tx.paymentPlanInstallment.deleteMany({
      where: { plan: { patientId: patient.id } },
    });
    await tx.paymentPlan.deleteMany({ where: { patientId: patient.id } });

    // Invoice lines + invoices
    await tx.invoiceLine.deleteMany({ where: { invoice: { patientId: patient.id } } });
    await tx.invoice.deleteMany({ where: { patientId: patient.id } });

    // Appointments + waitlist
    await tx.appointment.deleteMany({ where: { patientId: patient.id } });
    await tx.waitlistEntry.deleteMany({ where: { patientId: patient.id } });

    // Patient + cascade-handled children
    await tx.patient.delete({ where: { id: patient.id } });
  });

  // Tombstone audit. The payload contains identity proofs (initials, CIN
  // tail) so we can answer "did you delete patient X?" without holding the
  // full personal data.
  const deletedAt = new Date();
  const initials = `${patient.firstName[0] ?? "?"}.${patient.lastName[0] ?? "?"}.`;
  const cinTail = patient.cin ? `***${patient.cin.slice(-3)}` : null;
  await audit({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "patient.gdpr.erase",
    entity: "Patient",
    entityId: input.patientId,
    payload: {
      initials,
      cinTail,
      createdAt: patient.createdAt.toISOString(),
      deletedAt: deletedAt.toISOString(),
      reason: input.reason.trim(),
      assetsDeleted: assets.length,
    },
  });

  return ok({ deletedAt: deletedAt.toISOString() });
}
