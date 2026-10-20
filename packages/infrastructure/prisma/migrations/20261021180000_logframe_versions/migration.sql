-- The results framework is versioned: one append-only snapshot per change, with an optional sign-off.
CREATE TABLE "LogframeVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "LogframeVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogframeVersion_tenantId_projectId_version_key" ON "LogframeVersion"("tenantId", "projectId", "version");
CREATE INDEX "LogframeVersion_tenantId_projectId_idx" ON "LogframeVersion"("tenantId", "projectId");
