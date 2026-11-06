-- A person's own pinned tiles on their Home: a reference to a dashboard, never data (Phase 35.H4). Additive.
CREATE TABLE "HomePin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomePin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomePin_tenantId_userId_kind_ref_key" ON "HomePin"("tenantId", "userId", "kind", "ref");
CREATE INDEX "HomePin_tenantId_userId_idx" ON "HomePin"("tenantId", "userId");
