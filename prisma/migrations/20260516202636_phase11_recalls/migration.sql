-- CreateEnum
CREATE TYPE "recall_kind" AS ENUM ('SCALING', 'ANNUAL_CHECKUP', 'IMPLANT_FOLLOWUP', 'POST_EXTRACTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "recall_status" AS ENUM ('PENDING', 'SENT', 'APPOINTMENT_BOOKED', 'DISABLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "recall_reminders" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" "recall_kind" NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "recall_status" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "sentAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "disabledReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recall_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recall_reminders_clinicId_status_dueDate_idx" ON "recall_reminders"("clinicId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "recall_reminders_patientId_kind_idx" ON "recall_reminders"("patientId", "kind");

-- AddForeignKey
ALTER TABLE "recall_reminders" ADD CONSTRAINT "recall_reminders_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recall_reminders" ADD CONSTRAINT "recall_reminders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recall_reminders" ADD CONSTRAINT "recall_reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
