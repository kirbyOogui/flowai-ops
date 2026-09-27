-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "relatedRequestId" TEXT;

-- CreateIndex
CREATE INDEX "Request_requesterName_idx" ON "Request"("requesterName");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_relatedRequestId_fkey" FOREIGN KEY ("relatedRequestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
