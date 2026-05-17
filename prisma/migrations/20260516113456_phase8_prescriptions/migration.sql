-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drug" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_clinicId_patientId_issuedAt_idx" ON "prescriptions"("clinicId", "patientId", "issuedAt");

-- CreateIndex
CREATE INDEX "prescriptions_dentistId_idx" ON "prescriptions"("dentistId");

-- CreateIndex
CREATE INDEX "prescriptions_appointmentId_idx" ON "prescriptions"("appointmentId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_sortOrder_idx" ON "prescription_items"("prescriptionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
