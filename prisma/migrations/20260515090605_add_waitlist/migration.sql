-- CreateEnum
CREATE TYPE "waitlist_status" AS ENUM ('WAITING', 'PROPOSED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "waitlist_time_preference" AS ENUM ('ANY', 'MORNING', 'AFTERNOON');

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "timePreference" "waitlist_time_preference" NOT NULL DEFAULT 'ANY',
    "notBefore" TIMESTAMP(3),
    "notAfter" TIMESTAMP(3),
    "status" "waitlist_status" NOT NULL DEFAULT 'WAITING',
    "reason" TEXT,
    "proposedAt" TIMESTAMP(3),
    "proposedExpiresAt" TIMESTAMP(3),
    "proposedSlotStart" TIMESTAMP(3),
    "proposedSlotEnd" TIMESTAMP(3),
    "proposalToken" TEXT,
    "resultingAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_proposalToken_key" ON "waitlist_entries"("proposalToken");

-- CreateIndex
CREATE INDEX "waitlist_entries_clinicId_status_createdAt_idx" ON "waitlist_entries"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "waitlist_entries_patientId_idx" ON "waitlist_entries"("patientId");

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
