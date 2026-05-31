import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const id = process.argv[2] ?? "cmp5t5q9p00011cvjvje5hfw7";
  console.log(`Looking for patient ${id}...`);

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        select: { id: true, clinicId: true, startAt: true, dentistId: true, status: true },
        orderBy: { startAt: "desc" },
      },
    },
  });

  if (!patient) {
    console.log(`❌ Patient ${id} introuvable en DB.`);
    return;
  }

  console.log(`\n✅ Patient: ${patient.firstName} ${patient.lastName}`);
  console.log(`   clinicId: ${patient.clinicId}`);
  console.log(`   deletedAt: ${patient.deletedAt ?? "(active)"}`);
  console.log(`\n📅 ${patient.appointments.length} RDV :`);
  for (const a of patient.appointments) {
    console.log(`   ${a.id} | ${a.startAt.toISOString().slice(0,16)} | clinic=${a.clinicId} | dentist=${a.dentistId} | ${a.status}`);
  }

  // Check that the admin can fetch each appointment as written in getAppointment
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { clinicId: true },
  });
  if (admin) {
    console.log(`\nAdmin clinicId: ${admin.clinicId}`);
    for (const a of patient.appointments) {
      const fetched = await db.appointment.findFirst({
        where: { id: a.id, clinicId: admin.clinicId },
      });
      console.log(`   getAppointment(${a.id}) as admin → ${fetched ? "OK" : "❌ null (clinic mismatch)"}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
