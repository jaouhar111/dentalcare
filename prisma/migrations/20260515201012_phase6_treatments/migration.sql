-- CreateEnum
CREATE TYPE "tooth_surface" AS ENUM ('MESIAL', 'DISTAL', 'OCCLUSAL', 'VESTIBULAR', 'LINGUAL', 'INCISAL');

-- CreateEnum
CREATE TYPE "treatment_application_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "treatment_catalog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPrice" DECIMAL(10,2) NOT NULL,
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
    "requiresTooth" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#0891B2',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_applications" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "catalogItemId" TEXT NOT NULL,
    "dentistId" TEXT,
    "toothNumber" INTEGER,
    "surfaces" "tooth_surface"[],
    "status" "treatment_application_status" NOT NULL DEFAULT 'PLANNED',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "notes" TEXT,
    "performedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_catalog_clinicId_isActive_idx" ON "treatment_catalog"("clinicId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_catalog_clinicId_code_key" ON "treatment_catalog"("clinicId", "code");

-- CreateIndex
CREATE INDEX "treatment_applications_clinicId_patientId_createdAt_idx" ON "treatment_applications"("clinicId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "treatment_applications_appointmentId_idx" ON "treatment_applications"("appointmentId");

-- CreateIndex
CREATE INDEX "treatment_applications_catalogItemId_idx" ON "treatment_applications"("catalogItemId");

-- CreateIndex
CREATE INDEX "treatment_applications_status_idx" ON "treatment_applications"("status");

-- AddForeignKey
ALTER TABLE "treatment_catalog" ADD CONSTRAINT "treatment_catalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "treatment_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
