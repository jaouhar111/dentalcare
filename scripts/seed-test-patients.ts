/**
 * Inserts a handful of test patients to exercise the list / detail / edit pages.
 * Idempotent: deletes anything previously created by this script (matched by
 * the dedicated CIN range "TEST-*") before re-inserting.
 *
 * Usage: pnpm tsx scripts/seed-test-patients.ts
 */
import "dotenv/config";
import {
  BloodGroup,
  CommunicationChannel,
  Gender,
  PrismaClient,
} from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DIRECT_URL });
  const prisma = new PrismaClient({ adapter });

  const clinic = await prisma.clinic.findFirst({ where: { id: "seed-clinic-fes" } });
  if (!clinic) throw new Error("Clinic not seeded — run pnpm db:seed first");

  const admin = await prisma.user.findFirst({
    where: { email: "admin@dentalcare-fes.ma" },
  });
  if (!admin) throw new Error("Admin user not seeded — run pnpm db:seed first");

  // Clean up previous test runs.
  await prisma.patient.deleteMany({
    where: { clinicId: clinic.id, cin: { startsWith: "TEST-" } },
  });

  const fixtures = [
    {
      firstName: "Ahmed",
      lastName: "Bennali",
      cin: "TEST-AB001",
      phone: "+212612345678",
      email: "ahmed.bennali@example.ma",
      dob: new Date("1988-03-15"),
      gender: Gender.MALE,
      city: "Fès",
      bloodGroup: BloodGroup.O_POSITIVE,
      medicalHistory: "Diabète type 2 (metformine 1000mg), hypertension contrôlée.",
      preferredChannel: CommunicationChannel.WHATSAPP,
      preferredLocale: "ar",
      photoConsent: true,
      allergies: ["Pénicilline"],
    },
    {
      firstName: "Salma",
      lastName: "Bouhraoua",
      cin: "TEST-SB002",
      phone: "+212661234567",
      email: "salma.b@example.ma",
      dob: new Date("1997-09-22"),
      gender: Gender.FEMALE,
      city: "Fès",
      bloodGroup: BloodGroup.A_POSITIVE,
      preferredChannel: CommunicationChannel.WHATSAPP,
      preferredLocale: "fr",
      photoConsent: false,
      allergies: [],
    },
    {
      firstName: "Karim",
      lastName: "Amir",
      cin: "TEST-KA003",
      phone: "+212698765432",
      dob: new Date("1981-06-04"),
      gender: Gender.MALE,
      city: "Meknès",
      bloodGroup: BloodGroup.AB_NEGATIVE,
      preferredChannel: CommunicationChannel.PHONE,
      preferredLocale: "fr",
      photoConsent: false,
      allergies: ["Latex", "Iode"],
    },
  ];

  for (const f of fixtures) {
    const { allergies, ...rest } = f;
    await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        createdById: admin.id,
        photoConsentAt: f.photoConsent ? new Date() : null,
        ...rest,
        allergies: { create: allergies.map((label) => ({ label })) },
      },
    });
    console.log(`  ✓ ${f.firstName} ${f.lastName} (${f.cin})`);
  }

  const total = await prisma.patient.count({
    where: { clinicId: clinic.id, deletedAt: null },
  });
  console.log(`→ Total patients in clinic: ${total}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
