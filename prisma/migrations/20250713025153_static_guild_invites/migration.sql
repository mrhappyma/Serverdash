-- CreateTable
CREATE TABLE "staticGuildInvite" (
    "guildId" TEXT NOT NULL,
    "invite" TEXT NOT NULL,

    CONSTRAINT "staticGuildInvite_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE UNIQUE INDEX "staticGuildInvite_invite_key" ON "staticGuildInvite"("invite");
