/**
 * One-off diagnostic — answers "pourquoi je vois pas de rappel pour
 * le patient X ?".
 *
 * Usage:
 *   pnpm tsx scripts/diagnose-recalls.ts <patientId>
 *   pnpm tsx scripts/diagnose-recalls.ts                  (lists everyone, last 7 days)
 */

import "dotenv/config";
import { db } from "@/lib/db/client";

const RECALL_CODES = new Set(["DET", "COUR", "EXT", "EXTC"]);

async function main() {
  const patientId = process.argv[2];

  if (patientId) {
    await diagnosePatient(patientId);
  } else {
    await diagnoseRecentAppointments();
  }
}

async function diagnosePatient(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: {
      appointments: {
        orderBy: { startAt: "desc" },
        take: 10,
        include: {
          dentist: { select: { firstName: true, lastName: true } },
          treatmentApplications: {
            include: { catalogItem: { select: { code: true, name: true } } },
          },
        },
      },
      treatmentApplications: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { catalogItem: { select: { code: true, name: true } } },
      },
      recallReminders: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) {
    console.log(`❌ Patient ${patientId} introuvable.`);
    return;
  }

  console.log(`\n👤 ${patient.firstName} ${patient.lastName} (id: ${patient.id})`);
  console.log(`   ${patient.appointments.length} dernier(s) RDV affiché(s)\n`);

  console.log(`━━━━━━━━━━━━━━━━━━━━ RDV ━━━━━━━━━━━━━━━━━━━━`);
  for (const a of patient.appointments) {
    const dateStr = a.startAt.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(`\n  📅 ${dateStr} | Dr ${a.dentist.firstName} ${a.dentist.lastName} | status: ${a.status}`);
    if (a.treatmentApplications.length === 0) {
      console.log(`     ⚠ Aucun soin attaché à ce RDV → impossible de générer un rappel.`);
    } else {
      for (const app of a.treatmentApplications) {
        const code = app.catalogItem.code;
        const wouldTrigger = RECALL_CODES.has(code);
        const isCompleted = app.status === "COMPLETED";
        let icon = "⏳";
        if (isCompleted && wouldTrigger) icon = "✅";
        else if (isCompleted && !wouldTrigger) icon = "⚪";
        else if (!isCompleted && wouldTrigger) icon = "⚠";

        console.log(
          `     ${icon} ${code} (${app.catalogItem.name}) — ${app.status}`,
        );
        if (!isCompleted && wouldTrigger) {
          console.log(
            `        → Ce code est éligible MAIS le statut est "${app.status}". Passe-le en COMPLETED depuis la page RDV.`,
          );
        }
        if (isCompleted && !wouldTrigger) {
          console.log(
            `        → Code "${code}" pas dans la liste (DET, COUR, EXT, EXTC). Aucun rappel auto par design.`,
          );
        }
      }
    }
  }

  console.log(`\n\n━━━━━━━━━━━━━━━━━━━ RAPPELS ━━━━━━━━━━━━━━━━━━━`);
  if (patient.recallReminders.length === 0) {
    console.log(`\n  Aucun rappel pour ce patient.\n`);
  } else {
    for (const r of patient.recallReminders) {
      console.log(
        `\n  • ${r.kind} — ${r.status} — due ${r.dueDate.toLocaleDateString("fr-FR")}`,
      );
      if (r.reason) console.log(`    raison: ${r.reason}`);
      if (r.sentAt) console.log(`    envoyé le: ${r.sentAt.toISOString()}`);
      if (r.bookedAt) console.log(`    re-réservé le: ${r.bookedAt.toISOString()}`);
      if (r.disabledAt) console.log(`    désactivé le: ${r.disabledAt.toISOString()}`);
    }
  }

  console.log("");
  // Verdict
  const completedTriggering = patient.treatmentApplications.filter(
    (a) => a.status === "COMPLETED" && RECALL_CODES.has(a.catalogItem.code),
  );
  console.log(`━━━━━━━━━━━━━━━━━━━ DIAGNOSTIC ━━━━━━━━━━━━━━━━━━━`);
  if (completedTriggering.length === 0) {
    console.log(`\n❌ AUCUN soin COMPLETED avec un code éligible (DET/COUR/EXT/EXTC).`);
    console.log(`   → C'est pour ça qu'il n'y a aucun rappel auto.`);
    console.log(`   → Solutions:`);
    console.log(`     1. Passe un soin existant en COMPLETED (si tu en as un avec ces codes)`);
    console.log(`     2. Ajoute un soin avec un de ces codes + statut COMPLETED`);
    console.log(`     3. Crée un rappel manuel depuis /recalls (bouton "+ Nouveau")`);
  } else {
    console.log(`\n✅ ${completedTriggering.length} soin(s) éligible(s) trouvé(s).`);
    console.log(`   Si tu vois quand même 0 rappel dans la table, c'est un bug — ping-moi.`);
  }
  console.log("");
}

async function diagnoseRecentAppointments() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const appointments = await db.appointment.findMany({
    where: { startAt: { gte: sevenDaysAgo, lte: new Date() } },
    orderBy: { startAt: "desc" },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      treatmentApplications: {
        include: { catalogItem: { select: { code: true } } },
      },
    },
  });
  console.log(`\n${appointments.length} RDV ces 7 derniers jours.\n`);
  for (const a of appointments) {
    console.log(
      `  ${a.startAt.toLocaleString("fr-FR")} | ${a.patient.firstName} ${a.patient.lastName} | ${a.status} | ${a.treatmentApplications.length} soin(s)`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
