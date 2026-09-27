/*
  Warnings:

  - Added the required column `sessionId` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "sessionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoSession_lastSeenAt_idx" ON "DemoSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_sessionId_createdAt_idx" ON "AiUsageLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "Request_sessionId_receivedAt_idx" ON "Request"("sessionId", "receivedAt");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
