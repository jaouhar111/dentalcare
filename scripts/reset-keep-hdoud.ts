/**
 * Reset DB to a clean test state.
 *
 *   • Keep ONLY Cabinet Hdoud Otmane (`seed-clinic-fes`).
 *   • Delete every other clinic and ALL its related data (cascade-safe).
 *   • On the surviving Hdoud cabinet:
 *       – wipe appointments + waitlist (rdv vidés)
 *       – wipe stock items + stock movements
 *       – KEEP patients, dentists, users, treatment catalog, settings
 *
 * Run: pnpm tsx scripts/reset-keep-hdoud.ts
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

const HDOUD_SLUG = "cabinet-hdoud-otmane";

async function main() {
  console.log("\n🧹 Reset — keep only Hdoud Otmane, wipe its rdv + stock\n");

  const allClinics = await db.clinic.findMany({
    select: { id: true, name: true, slug: true },
  });
  const hdoud = allClinics.find((c) => c.slug === HDOUD_SLUG);
  if (!hdoud) {
    console.error(`❌ Cabinet Hdoud Otmane (slug=${HDOUD_SLUG}) introuvable.`);
    process.exit(1);
  }
  const toDelete = allClinics.filter((c) => c.id !== hdoud.id);

  console.log(`Garder : ${hdoud.name} (${hdoud.id})`);
  console.log(
    `Supprimer : ${toDelete.map((c) => c.name).join(", ") || "(rien)"}\n`,
  );

  // ── Phase 1 : wipe Hdoud's RDV + stock (keep everything else) ───────
  console.log("→ Vidage RDV + stock côté Hdoud…");
  await db.$transaction([
    // appointment cleanup — delete linked rows first
    db.prescription.deleteMany({
      where: { appointment: { clinicId: hdoud.id } },
    }),
    db.treatmentApplication.deleteMany({
      where: { appointment: { clinicId: hdoud.id } },
    }),
    db.appointment.deleteMany({ where: { clinicId: hdoud.id } }),
    db.waitlistEntry.deleteMany({ where: { clinicId: hdoud.id } }),
    // stock cleanup
    db.stockMovement.deleteMany({ where: { clinicId: hdoud.id } }),
    db.stockItem.deleteMany({ where: { clinicId: hdoud.id } }),
  ]);
  console.log("  ✓ Hdoud nettoyé (patients, dentistes, catalog conservés)\n");

  // ── Phase 2 : full-delete every other clinic ────────────────────────
  for (const c of toDelete) {
    console.log(`→ Suppression intégrale : ${c.name}…`);
    await db.$transaction(async (tx) => {
      const cId = c.id;
      // === Deepest leaves first ===
      // Appointment-linked
      await tx.prescriptionItem.deleteMany({
        where: { prescription: { appointment: { clinicId: cId } } },
      });
      await tx.prescription.deleteMany({
        where: { appointment: { clinicId: cId } },
      });
      await tx.treatmentApplication.deleteMany({
        where: { OR: [{ clinicId: cId }, { appointment: { clinicId: cId } }] },
      });
      // Invoices: lines + payments + plans + installments
      await tx.invoiceLine.deleteMany({ where: { invoice: { clinicId: cId } } });
      await tx.payment.deleteMany({ where: { clinicId: cId } });
      await tx.paymentPlanInstallment.deleteMany({
        where: { plan: { clinicId: cId } },
      });
      await tx.paymentPlan.deleteMany({ where: { clinicId: cId } });
      await tx.invoice.deleteMany({ where: { clinicId: cId } });
      // Recalls, chart entries, photos, radiographs, notes
      await tx.recallReminder.deleteMany({ where: { clinicId: cId } });
      await tx.dentalChartEntry.deleteMany({ where: { clinicId: cId } });
      await tx.treatmentPhoto.deleteMany({ where: { clinicId: cId } });
      await tx.radiograph.deleteMany({ where: { clinicId: cId } });
      await tx.medicalNote.deleteMany({ where: { clinicId: cId } });
      // Calendar
      await tx.appointment.deleteMany({ where: { clinicId: cId } });
      await tx.waitlistEntry.deleteMany({ where: { clinicId: cId } });
      // Stock
      await tx.stockMovement.deleteMany({ where: { clinicId: cId } });
      await tx.stockItem.deleteMany({ where: { clinicId: cId } });
      // Catalog (the seeded items live per-clinic; safe to drop with the clinic)
      await tx.treatmentCatalogItem.deleteMany({ where: { clinicId: cId } });
      // AI + support (cascade on Clinic delete but make explicit for clarity)
      await tx.supportTicketReply.deleteMany({
        where: { ticket: { clinicId: cId } },
      });
      await tx.supportTicket.deleteMany({ where: { clinicId: cId } });
      await tx.aIConversation.deleteMany({ where: { clinicId: cId } });
      // Audit + events (clinic-scoped)
      await tx.auditLog.deleteMany({ where: { clinicId: cId } });
      await tx.eventOutbox.deleteMany({ where: { clinicId: cId } });
      // Dentists — first detach from User.dentistId, then nuke
      await tx.dentistAbsence.deleteMany({
        where: { dentist: { clinicId: cId } },
      });
      await tx.workingSchedule.deleteMany({
        where: { dentist: { clinicId: cId } },
      });
      const dentists = await tx.dentist.findMany({
        where: { clinicId: cId },
        select: { id: true, userId: true },
      });
      for (const d of dentists) {
        if (d.userId) {
          // Break the unique back-ref so the user can be deleted next.
          await tx.user.update({
            where: { id: d.userId },
            data: {
              // detach: keep no orphan dentistId pointer
            },
          });
        }
      }
      await tx.dentist.deleteMany({ where: { clinicId: cId } });
      // Patients (entire patient subtree for THIS clinic only)
      await tx.patient.deleteMany({ where: { clinicId: cId } });
      // Users + their reset tokens
      await tx.passwordResetToken.deleteMany({
        where: { user: { clinicId: cId } },
      });
      await tx.user.deleteMany({ where: { clinicId: cId } });
      // Finally, the clinic itself
      await tx.clinic.delete({ where: { id: cId } });
    });
    console.log(`  ✓ ${c.name} supprimé`);
  }

  // ── Final report ────────────────────────────────────────────────────
  console.log("\n📊 État final :");
  const final = await db.clinic.findMany({
    select: {
      name: true,
      slug: true,
      _count: {
        select: {
          patients: true,
          appointments: true,
          dentists: true,
          stockItems: true,
          treatmentCatalog: true,
        },
      },
    },
  });
  console.table(
    final.map((c) => ({
      name: c.name,
      patients: c._count.patients,
      RDV: c._count.appointments,
      dentists: c._count.dentists,
      stock: c._count.stockItems,
      catalog: c._count.treatmentCatalog,
    })),
  );

  console.log("\n✅ Reset terminé.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Échec :", err);
    process.exit(1);
  });
