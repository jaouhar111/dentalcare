-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'EMITTED', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_plan_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "installment_status" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "number" TEXT,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "emittedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "treatmentApplicationId" TEXT,
    "description" TEXT NOT NULL,
    "toothNumber" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "installmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "payment_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plan_installments" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "installment_status" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reminderJ3SentAt" TIMESTAMP(3),
    "reminderJ1SentAt" TIMESTAMP(3),

    CONSTRAINT "payment_plan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_clinicId_status_idx" ON "invoices"("clinicId", "status");

-- CreateIndex
CREATE INDEX "invoices_clinicId_patientId_emittedAt_idx" ON "invoices"("clinicId", "patientId", "emittedAt");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_clinicId_number_key" ON "invoices"("clinicId", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_sortOrder_idx" ON "invoice_lines"("invoiceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "payments_installmentId_key" ON "payments"("installmentId");

-- CreateIndex
CREATE INDEX "payments_clinicId_receivedAt_idx" ON "payments"("clinicId", "receivedAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_plans_invoiceId_key" ON "payment_plans"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_plans_clinicId_status_idx" ON "payment_plans"("clinicId", "status");

-- CreateIndex
CREATE INDEX "payment_plan_installments_dueDate_status_idx" ON "payment_plan_installments"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_plan_installments_planId_sequence_key" ON "payment_plan_installments"("planId", "sequence");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_treatmentApplicationId_fkey" FOREIGN KEY ("treatmentApplicationId") REFERENCES "treatment_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "payment_plan_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "payment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
