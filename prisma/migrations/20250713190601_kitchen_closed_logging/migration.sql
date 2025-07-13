/*
  Warnings:

  - You are about to drop the `KitchenConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "KitchenConfig";

-- CreateTable
CREATE TABLE "kitchenClosed" (
    "id" SERIAL NOT NULL,
    "by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" TIMESTAMP(3),

    CONSTRAINT "kitchenClosed_pkey" PRIMARY KEY ("id")
);
