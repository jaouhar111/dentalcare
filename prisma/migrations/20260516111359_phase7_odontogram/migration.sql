-- CreateEnum
CREATE TYPE "dental_condition" AS ENUM ('HEALTHY', 'CARIES', 'FILLING', 'CROWN', 'IMPLANT', 'MISSING', 'TO_EXTRACT', 'DEVITALIZED', 'FRACTURE', 'PROSTHESIS');

-- CreateTable
CREATE TABLE "dental_chart_entries" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "condition" "dental_condition" NOT NULL,
    "surfaces" "tooth_surface"[],
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_chart_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dental_chart_entries_clinicId_patientId_recordedAt_idx" ON "dental_chart_entries"("clinicId", "patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "dental_chart_entries_patientId_toothNumber_recordedAt_idx" ON "dental_chart_entries"("patientId", "toothNumber", "recordedAt");

-- AddForeignKey
ALTER TABLE "dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_chart_entries" ADD CONSTRAINT "dental_chart_entries_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
