/**
 * Idempotent seed script.
 *
 * Creates (or no-ops on re-run) a single clinic and three test users
 * covering all V1 roles. Passwords come from env (.env). Re-running is safe;
 * existing rows are detected by `email` (users) and a fixed `name` (clinic).
 *
 * Run with: `pnpm db:seed`
 */

import "dotenv/config";
import { randomInt } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "@node-rs/argon2";

const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 };

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

async function main() {
  // Use direct URL for seed (no pooler) — same convention as migrations.
  const adapter = new PrismaNeon({ connectionString: requireEnv("DIRECT_URL") });
  const prisma = new PrismaClient({ adapter });

  const CLINIC_NAME = "Cabinet DentalCare Fès";

  console.log("→ Seeding clinic + users…");

  const clinic = await prisma.clinic.upsert({
    where: { id: "seed-clinic-fes" },
    create: {
      id: "seed-clinic-fes",
      name: CLINIC_NAME,
      address: "Avenue Hassan II, Fès",
      phone: "+212535000000",
      email: "contact@dentalcare-fes.ma",
      defaultLocale: "fr",
      // Random starting number in [1000, 9999] — preserves billing-volume privacy.
      invoiceStartingNumber: randomInt(1000, 9999),
    },
    update: {
      // Don't touch invoiceStartingNumber on re-run (sequence is sensitive).
      name: CLINIC_NAME,
    },
  });

  const users = [
    {
      email: requireEnv("SEED_ADMIN_EMAIL").toLowerCase(),
      password: requireEnv("SEED_ADMIN_PASSWORD"),
      role: UserRole.ADMIN,
      fullName: "Admin DentalCare",
    },
    {
      email: requireEnv("SEED_DENTIST_EMAIL").toLowerCase(),
      password: requireEnv("SEED_DENTIST_PASSWORD"),
      role: UserRole.DENTIST,
      fullName: "Dr Karim Benali",
    },
    {
      email: requireEnv("SEED_RECEPTIONIST_EMAIL").toLowerCase(),
      password: requireEnv("SEED_RECEPTIONIST_PASSWORD"),
      role: UserRole.RECEPTIONIST,
      fullName: "Fatima Recep",
    },
  ];

  const seededUsers: Record<string, { id: string }> = {};
  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    const saved = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        role: u.role,
        fullName: u.fullName,
        clinicId: clinic.id,
        isActive: true,
      },
      update: {
        // Re-hash password on every seed (lets admins rotate by editing env + re-running).
        passwordHash,
        role: u.role,
        fullName: u.fullName,
        isActive: true,
      },
      select: { id: true },
    });
    seededUsers[u.email] = saved;
    console.log(`  ✓ ${u.role.padEnd(13)} ${u.email}`);
  }

  // ─── Dentists (with schedules + one absence) ─────────────────────────────
  console.log("→ Seeding dentists…");

  const dentistFixtures = [
    {
      id: "seed-dentist-karim",
      userEmail: users[1].email,
      firstName: "Karim",
      lastName: "Benali",
      specialty: "Implantologue",
      phone: "+212612345678",
      email: "karim.benali@dentalcare-fes.ma",
      color: "#0891B2",
      // Mon-Fri 09:00-12:30 + 14:00-18:00
      schedule: [1, 2, 3, 4, 5].flatMap((day) => [
        { dayOfWeek: day, startTime: "09:00", endTime: "12:30" },
        { dayOfWeek: day, startTime: "14:00", endTime: "18:00" },
      ]),
      withAbsence: true,
    },
    {
      id: "seed-dentist-salma",
      userEmail: null,
      firstName: "Salma",
      lastName: "Idrissi",
      specialty: "Orthodontiste",
      phone: "+212661234567",
      email: "salma.idrissi@dentalcare-fes.ma",
      color: "#059669",
      // Mon, Wed, Fri 10:00-17:00, Sat 09:00-13:00
      schedule: [
        { dayOfWeek: 1, startTime: "10:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "10:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "10:00", endTime: "17:00" },
        { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" },
      ],
      withAbsence: false,
    },
  ];

  for (const d of dentistFixtures) {
    const userId = d.userEmail ? seededUsers[d.userEmail]?.id ?? null : null;
    await prisma.dentist.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        clinicId: clinic.id,
        userId,
        firstName: d.firstName,
        lastName: d.lastName,
        specialty: d.specialty,
        phone: d.phone,
        email: d.email,
        color: d.color,
      },
      update: {
        userId,
        firstName: d.firstName,
        lastName: d.lastName,
        specialty: d.specialty,
        phone: d.phone,
        email: d.email,
        color: d.color,
        isActive: true,
      },
    });

    // Replace schedule atomically.
    await prisma.workingSchedule.deleteMany({ where: { dentistId: d.id } });
    if (d.schedule.length > 0) {
      await prisma.workingSchedule.createMany({
        data: d.schedule.map((r) => ({ dentistId: d.id, ...r })),
      });
    }

    // Replace absences (one for Karim: 2 weeks of summer holidays).
    await prisma.dentistAbsence.deleteMany({ where: { dentistId: d.id } });
    if (d.withAbsence) {
      await prisma.dentistAbsence.create({
        data: {
          dentistId: d.id,
          startAt: new Date("2026-08-01T00:00:00Z"),
          endAt: new Date("2026-08-15T23:59:59Z"),
          reason: "Congés d'été",
        },
      });
    }

    console.log(
      `  ✓ Dr ${d.firstName} ${d.lastName} · ${d.specialty} · ${d.schedule.length} plages${d.withAbsence ? " · 1 absence" : ""}`,
    );
  }

  // ─── Treatment catalog (Phase 6) ────────────────────────────────────────
  // Prices reflect typical Fès rates as of 2026 — clinic admin can edit them
  // via /settings/treatments. `requiresTooth` is true for acts that target a
  // specific dent (caries, extractions, endo, crowns).
  const treatments = [
    { code: "DET", name: "Détartrage", color: "#06B6D4", price: 300, dur: 30, tooth: false },
    { code: "COMP1", name: "Composite simple (1 surface)", color: "#3B82F6", price: 350, dur: 30, tooth: true },
    { code: "COMP3", name: "Composite complexe (2-3 surfaces)", color: "#6366F1", price: 500, dur: 45, tooth: true },
    { code: "EXT", name: "Extraction simple", color: "#F59E0B", price: 200, dur: 30, tooth: true },
    { code: "EXTC", name: "Extraction chirurgicale", color: "#EF4444", price: 500, dur: 60, tooth: true },
    { code: "ENDO1", name: "Endodontie monoradiculée", color: "#8B5CF6", price: 1000, dur: 60, tooth: true },
    { code: "ENDO3", name: "Endodontie pluriradiculée", color: "#A855F7", price: 1500, dur: 90, tooth: true },
    { code: "COUR", name: "Couronne céramique", color: "#10B981", price: 2500, dur: 60, tooth: true },
    { code: "BLANC", name: "Blanchiment dentaire", color: "#F0F9FF", price: 1500, dur: 60, tooth: false },
  ] as const;

  for (let i = 0; i < treatments.length; i++) {
    const t = treatments[i]!;
    await prisma.treatmentCatalogItem.upsert({
      where: { clinicId_code: { clinicId: clinic.id, code: t.code } },
      update: {
        name: t.name,
        defaultPrice: t.price,
        defaultDurationMin: t.dur,
        requiresTooth: t.tooth,
        color: t.color,
        sortOrder: (i + 1) * 10,
      },
      create: {
        clinicId: clinic.id,
        code: t.code,
        name: t.name,
        defaultPrice: t.price,
        defaultDurationMin: t.dur,
        requiresTooth: t.tooth,
        color: t.color,
        sortOrder: (i + 1) * 10,
      },
    });
  }
  console.log(`→ Catalogue traitements: ${treatments.length} actes`);

  // ─── Stock seed (Phase 10) ──────────────────────────────────────────────
  // 5 staple cabinet items — admin can edit codes/prices later.
  const stockItems = [
    {
      code: "GANT-S",
      name: "Gants latex taille S",
      unit: "boîte",
      category: "Consommables",
      lowStockAt: 5,
      opening: 12,
    },
    {
      code: "MASQ",
      name: "Masques chirurgicaux 3 plis",
      unit: "boîte",
      category: "Consommables",
      lowStockAt: 4,
      opening: 8,
    },
    {
      code: "ANES-LIDO",
      name: "Anesthésique lidocaïne 2%",
      unit: "carpule",
      category: "Anesthésiques",
      lowStockAt: 20,
      opening: 50,
    },
    {
      code: "COMP-A2",
      name: "Composite teinte A2",
      unit: "seringue",
      category: "Composites",
      lowStockAt: 3,
      opening: 6,
    },
    {
      code: "FRAISE-D",
      name: "Fraises diamant assortiment",
      unit: "boîte",
      category: "Instruments",
      lowStockAt: 2,
      opening: 4,
    },
  ] as const;

  for (const s of stockItems) {
    const created = await prisma.stockItem.upsert({
      where: { clinicId_code: { clinicId: clinic.id, code: s.code } },
      update: {},
      create: {
        clinicId: clinic.id,
        code: s.code,
        name: s.name,
        unit: s.unit,
        category: s.category,
        lowStockAt: s.lowStockAt,
      },
    });
    // Add opening movement only if no movements yet (idempotent reseed).
    const existing = await prisma.stockMovement.count({ where: { itemId: created.id } });
    if (existing === 0) {
      await prisma.stockMovement.create({
        data: {
          clinicId: clinic.id,
          itemId: created.id,
          type: "OPENING",
          quantity: s.opening,
          note: "Stock initial (seed)",
          createdById: (await prisma.user.findFirst({ where: { clinicId: clinic.id, role: "ADMIN" } }))!.id,
        },
      });
    }
  }
  console.log(`→ Stock: ${stockItems.length} articles seedés`);

  console.log(
    `→ Done. Clinic: ${clinic.id} (invoice start: F-YYYY-${clinic.invoiceStartingNumber.toString().padStart(4, "0")})`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
