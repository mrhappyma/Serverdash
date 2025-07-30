-- CreateTable
CREATE TABLE "sentChefInactivityWarning" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "givenDeadline" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sentChefInactivityWarning_pkey" PRIMARY KEY ("id")
);
