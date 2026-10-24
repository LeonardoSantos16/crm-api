-- CreateEnum
CREATE TYPE "LossReason" AS ENUM ('PRICE', 'DELIVERY_TIME', 'COMPETITOR', 'NO_BUDGET', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'MEETING');

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "lossDetail" TEXT,
ADD COLUMN     "nextFollowUpAt" DATE,
ADD COLUMN     "snoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "snoozedUntil" DATE;

-- ConvertLossReason
UPDATE "Opportunity" SET "lossDetail" = "lossReason" WHERE "lossReason" IS NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "lossReason" TYPE "LossReason" USING (CASE WHEN "lossReason" IS NULL THEN NULL ELSE 'OTHER' END)::"LossReason";

-- AlterTable
ALTER TABLE "OpportunityItem" ADD COLUMN     "unitValue" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" SERIAL NOT NULL,
    "channel" "FollowUpChannel",
    "summary" TEXT,
    "nextDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snooze" (
    "id" SERIAL NOT NULL,
    "until" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Snooze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" INTEGER NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUp_opportunityId_createdAt_idx" ON "FollowUp"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "Snooze_opportunityId_createdAt_idx" ON "Snooze"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_opportunityId_createdAt_idx" ON "Comment"("opportunityId", "createdAt");

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snooze" ADD CONSTRAINT "Snooze_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snooze" ADD CONSTRAINT "Snooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

