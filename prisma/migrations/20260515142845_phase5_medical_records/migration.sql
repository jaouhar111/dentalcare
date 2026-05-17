-- CreateEnum
CREATE TYPE "radiograph_kind" AS ENUM ('PANORAMIC', 'PERIAPICAL', 'BITEWING', 'CEPHALOMETRIC', 'CBCT', 'OCCLUSAL', 'OTHER');

-- CreateEnum
CREATE TYPE "treatment_photo_stage" AS ENUM ('BEFORE', 'DURING', 'AFTER');

-- CreateTable
CREATE TABLE "medical_notes" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiographs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT,
    "kind" "radiograph_kind" NOT NULL DEFAULT 'PANORAMIC',
    "publicId" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiographs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_photos" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT,
    "appointmentId" TEXT,
    "stage" "treatment_photo_stage" NOT NULL DEFAULT 'BEFORE',
    "publicId" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_notes_clinicId_patientId_createdAt_idx" ON "medical_notes"("clinicId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "medical_notes_appointmentId_idx" ON "medical_notes"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "radiographs_publicId_key" ON "radiographs"("publicId");

-- CreateIndex
CREATE INDEX "radiographs_clinicId_patientId_takenAt_idx" ON "radiographs"("clinicId", "patientId", "takenAt");

-- CreateIndex
CREATE INDEX "radiographs_kind_idx" ON "radiographs"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_photos_publicId_key" ON "treatment_photos"("publicId");

-- CreateIndex
CREATE INDEX "treatment_photos_clinicId_patientId_createdAt_idx" ON "treatment_photos"("clinicId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "treatment_photos_appointmentId_idx" ON "treatment_photos"("appointmentId");

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_photos" ADD CONSTRAINT "treatment_photos_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_photos" ADD CONSTRAINT "treatment_photos_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_photos" ADD CONSTRAINT "treatment_photos_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_photos" ADD CONSTRAINT "treatment_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
