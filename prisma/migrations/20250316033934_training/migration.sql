-- AlterEnum
ALTER TYPE "applicationStatus" ADD VALUE 'TRAINING';

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "trainingSessionId" INTEGER;

-- CreateTable
CREATE TABLE "trainingSession" (
    "id" SERIAL NOT NULL,
    "user" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'welcome',
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainingSession_threadId_key" ON "trainingSession"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "trainingSession_orderId_key" ON "trainingSession"("orderId");

-- AddForeignKey
ALTER TABLE "trainingSession" ADD CONSTRAINT "trainingSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
