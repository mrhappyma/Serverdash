/*
  Warnings:

  - You are about to drop the column `active` on the `application` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "applicationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'STALE');

-- AlterTable
ALTER TABLE "application" DROP COLUMN "active",
ADD COLUMN     "status" "applicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- set existing rows to 'STALE'
UPDATE "application" SET "status" = 'STALE';