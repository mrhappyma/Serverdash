-- CreateEnum
CREATE TYPE "orderStatus" AS ENUM ('ORDERED', 'FILLING', 'PACKING', 'PACKED', 'DELIVERING', 'DELIVERED', 'REJECTED');

-- CreateTable
CREATE TABLE "order" (
    "id" SERIAL NOT NULL,
    "status" "orderStatus" NOT NULL DEFAULT 'ORDERED',
    "order" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT,
    "customerId" TEXT NOT NULL,
    "customerUsername" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "statusMessageId" TEXT NOT NULL,
    "chefId" TEXT,
    "chefUsername" TEXT,
    "deliveryId" TEXT,
    "deliveryUsername" TEXT,
    "fileUrl" TEXT,
    "rejectedReason" TEXT,
    "rejectorId" TEXT,
    "relatedKitchenMessages" TEXT[],
    "invite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chef" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "backticks" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenConfig" (
    "id" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "closedReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "KitchenConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application" (
    "id" SERIAL NOT NULL,
    "user" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban" (
    "id" SERIAL NOT NULL,
    "user" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "appealAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ban_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_guildId_customerId_idx" ON "order"("status", "guildId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "application_token_key" ON "application"("token");

