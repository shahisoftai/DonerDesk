-- Phase 25.6: create requests carry an idempotency key; the first response is stored and replayed on a repeat.
CREATE TABLE "RequestIdempotency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "statusCode" INTEGER,
    "responseJson" TEXT,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RequestIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequestIdempotency_tenantId_userId_route_key_key" ON "RequestIdempotency"("tenantId", "userId", "route", "key");
CREATE INDEX "RequestIdempotency_tenantId_idx" ON "RequestIdempotency"("tenantId");
CREATE INDEX "RequestIdempotency_createdAt_idx" ON "RequestIdempotency"("createdAt");
