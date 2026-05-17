-- CreateTable
CREATE TABLE "meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_pkey" PRIMARY KEY ("key")
);
