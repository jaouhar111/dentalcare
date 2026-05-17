-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULE_REQUESTED');

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "notes" TEXT,
    "confirmationToken" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "confirmationReceivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancelledLate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointments_confirmationToken_key" ON "appointments"("confirmationToken");

-- CreateIndex
CREATE INDEX "appointments_clinicId_startAt_idx" ON "appointments"("clinicId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_dentistId_startAt_idx" ON "appointments"("dentistId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_patientId_startAt_idx" ON "appointments"("patientId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
