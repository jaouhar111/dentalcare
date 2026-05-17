/*
  Warnings:

  - You are about to drop the column `dentistId` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "dentistId";

-- CreateTable
CREATE TABLE "dentists" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0891B2',
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dentists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_schedules" (
    "id" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "working_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_absences" (
    "id" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dentist_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dentists_userId_key" ON "dentists"("userId");

-- CreateIndex
CREATE INDEX "dentists_clinicId_isActive_idx" ON "dentists"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "working_schedules_dentistId_dayOfWeek_idx" ON "working_schedules"("dentistId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "dentist_absences_dentistId_startAt_idx" ON "dentist_absences"("dentistId", "startAt");

-- AddForeignKey
ALTER TABLE "dentists" ADD CONSTRAINT "dentists_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentists" ADD CONSTRAINT "dentists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_schedules" ADD CONSTRAINT "working_schedules_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_absences" ADD CONSTRAINT "dentist_absences_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
