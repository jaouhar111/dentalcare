-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "blood_group" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "communication_channel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE');

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "cin" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "dob" DATE NOT NULL,
    "gender" "gender",
    "address" TEXT,
    "city" TEXT,
    "bloodGroup" "blood_group",
    "photoUrl" TEXT,
    "medicalHistory" TEXT,
    "preferredChannel" "communication_channel" NOT NULL DEFAULT 'WHATSAPP',
    "preferredLocale" TEXT NOT NULL DEFAULT 'fr',
    "photoConsent" BOOLEAN NOT NULL DEFAULT false,
    "photoConsentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_clinicId_deletedAt_idx" ON "patients"("clinicId", "deletedAt");

-- CreateIndex
CREATE INDEX "patients_clinicId_lastName_firstName_idx" ON "patients"("clinicId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "patients_clinicId_cin_key" ON "patients"("clinicId", "cin");

-- CreateIndex
CREATE INDEX "patient_allergies_patientId_idx" ON "patient_allergies"("patientId");

-- CreateIndex
CREATE INDEX "audit_log_clinicId_createdAt_idx" ON "audit_log"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Trigram FTS index for fast patient search (cf. SPEC §4.2 + §4.13) ───
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "patients_search_idx" ON "patients"
USING GIN ((
    LOWER("firstName") || ' ' ||
    LOWER("lastName")  || ' ' ||
    LOWER(COALESCE("cin", '')) || ' ' ||
    "phone"
) gin_trgm_ops)
WHERE "deletedAt" IS NULL;
