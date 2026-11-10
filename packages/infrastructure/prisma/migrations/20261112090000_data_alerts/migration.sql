-- A person's own threshold alert on one indicator: a rule and the state it was last seen in (Phase 48.16). Additive.
CREATE TABLE "DataAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "ruleKind" TEXT NOT NULL,
    "ruleValue" DOUBLE PRECISION,
    "lastState" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataAlert_tenantId_userId_idx" ON "DataAlert"("tenantId", "userId");
