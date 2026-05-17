/**
 * Seed a handful of test appointments spread over the current week.
 * Idempotent: deletes anything previously created by this script first.
 *
 * Usage: pnpm tsx scripts/seed-test-appointments.ts
 */
import "dotenv/config";
import { PrismaClient, AppointmentStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DIRECT_URL });
  const prisma = new PrismaClient({ adapter });

  const clinic = await prisma.clinic.findFirstOrThrow({ where: { id: "seed-clinic-fes" } });
  const admin = await prisma.user.findFirstOrThrow({
    where: { email: "admin@dentalcare-fes.ma" },
  });

  const drKarim = await prisma.dentist.findFirstOrThrow({ where: { id: "seed-dentist-karim" } });
  const drSalma = await prisma.dentist.findFirstOrThrow({ where: { id: "seed-dentist-salma" } });

  const patients = await prisma.patient.findMany({
    where: { clinicId: clinic.id, cin: { startsWith: "TEST-" } },
    select: { id: true, firstName: true },
  });
  if (patients.length === 0) {
    console.log("→ No test patients yet. Run scripts/seed-test-patients.ts first.");
    return;
  }

  // Clean previous test appointments (we tag them via the `notes` field).
  await prisma.appointment.deleteMany({
    where: { clinicId: clinic.id, notes: "[seed-test]" },
  });

  // Build appointments anchored to the current week's Monday.
  const monday = new Date();
  const dow = monday.getDay();
  monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow));
  monday.setHours(0, 0, 0, 0);

  const at = (dayOffset: number, h: number, m: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const fixtures: Array<{
    patientIdx: number;
    dentistId: string;
    start: Date;
    durationMin: number;
    reason: string;
    status?: AppointmentStatus;
  }> = [
    { patientIdx: 0, dentistId: drKarim.id, start: at(0, 9, 0), durationMin: 30, reason: "Détartrage" },
    { patientIdx: 1, dentistId: drSalma.id, start: at(0, 10, 30), durationMin: 60, reason: "Implant" },
    { patientIdx: 2, dentistId: drKarim.id, start: at(0, 14, 0), durationMin: 45, reason: "Carie 15", status: AppointmentStatus.CONFIRMED },
    { patientIdx: 0, dentistId: drKarim.id, start: at(2, 9, 30), durationMin: 60, reason: "Couronne céramique", status: AppointmentStatus.CONFIRMED },
    { patientIdx: 1, dentistId: drSalma.id, start: at(2, 15, 0), durationMin: 30, reason: "Suivi orthodontie" },
    { patientIdx: 2, dentistId: drKarim.id, start: at(3, 11, 0), durationMin: 30, reason: "Contrôle annuel" },
    { patientIdx: 0, dentistId: drSalma.id, start: at(4, 10, 0), durationMin: 45, reason: "Blanchiment", status: AppointmentStatus.CANCELLED },
  ];

  for (const f of fixtures) {
    const patient = patients[f.patientIdx % patients.length]!;
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        dentistId: f.dentistId,
        startAt: f.start,
        endAt: new Date(f.start.getTime() + f.durationMin * 60_000),
        reason: f.reason,
        notes: "[seed-test]",
        status: f.status ?? AppointmentStatus.SCHEDULED,
        createdById: admin.id,
        ...(f.status === AppointmentStatus.CANCELLED
          ? { cancelledAt: new Date(), cancellationReason: "Empêchement patient" }
          : {}),
      },
    });
  }

  const count = await prisma.appointment.count({ where: { clinicId: clinic.id, notes: "[seed-test]" } });
  console.log(`→ Seeded ${count} test appointments for this week`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
