-- Jobs the API could not hand to the queue are kept and retried instead of being logged and lost.
CREATE TABLE "JobOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobOutbox_status_nextAttemptAt_idx" ON "JobOutbox"("status", "nextAttemptAt");
CREATE INDEX "JobOutbox_tenantId_idx" ON "JobOutbox"("tenantId");
