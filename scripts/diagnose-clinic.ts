/**
 * Verify that the admin user's clinicId matches the appointments + patient.
 *
 * Run with:
 *   pnpm tsx scripts/diagnose-clinic.ts
 */

import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, clinicId: true, fullName: true },
  });

  console.log(`\n👤 Admin users (${admins.length})`);
  for (const a of admins) {
    console.log(`   ${a.email} → clinicId: ${a.clinicId}`);
  }

  const clinics = await db.clinic.findMany({
    select: { id: true, name: true, _count: { select: { patients: true, appointments: true, dentists: true } } },
  });
  console.log(`\n🏥 Clinics (${clinics.length})`);
  for (const c of clinics) {
    console.log(`   ${c.name} (${c.id}) → ${c._count.patients} patients, ${c._count.appointments} RDV, ${c._count.dentists} dentistes`);
  }

  const patient = await db.patient.findFirst({
    where: {
      OR: [
        { id: "cmp5t5q9p00011cvjvje5hfw7" },
        { firstName: { contains: "Jaouhar", mode: "insensitive" } },
        { lastName: { contains: "Jaouhar", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, clinicId: true },
  });

  if (patient) {
    console.log(`\n👨 Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`   id      : ${patient.id}`);
    console.log(`   clinicId: ${patient.clinicId}`);

    const appts = await db.appointment.findMany({
      where: { patientId: patient.id },
      select: { id: true, startAt: true, clinicId: true, dentistId: true },
      orderBy: { startAt: "desc" },
    });
    console.log(`\n📅 ${appts.length} RDV pour ce patient :`);
    for (const a of appts) {
      console.log(`   ${a.id} | ${a.startAt.toISOString().slice(0, 16)} | clinicId: ${a.clinicId} | dentistId: ${a.dentistId}`);
    }

    // Cross-check with admin
    const adminClinicIds = new Set(admins.map((a) => a.clinicId));
    const apptClinicIds = new Set(appts.map((a) => a.clinicId));
    const mismatch = [...apptClinicIds].find((c) => !adminClinicIds.has(c));
    if (mismatch) {
      console.log(`\n❌ MISMATCH DÉTECTÉ : un (ou plus) RDV est dans le clinic "${mismatch}" alors qu'aucun admin n'appartient à ce clinic.`);
      console.log(`   → Le getAppointment() filtre par clinicId = celui de la session admin → renvoie null → 404.`);
    } else {
      console.log(`\n✅ Tous les RDV sont dans des clinics qui ont au moins un admin.`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
