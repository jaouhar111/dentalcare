-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('OPENING', 'PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN');

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "lowStockAt" INTEGER,
    "expiresAt" DATE,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_items_clinicId_isActive_idx" ON "stock_items"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "stock_items_category_idx" ON "stock_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_clinicId_code_key" ON "stock_items"("clinicId", "code");

-- CreateIndex
CREATE INDEX "stock_movements_clinicId_recordedAt_idx" ON "stock_movements"("clinicId", "recordedAt");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_recordedAt_idx" ON "stock_movements"("itemId", "recordedAt");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
