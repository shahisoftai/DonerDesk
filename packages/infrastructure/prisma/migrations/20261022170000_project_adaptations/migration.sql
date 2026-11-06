CREATE TABLE "ProjectAdaptation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recordedOn" DATE NOT NULL,
    "whatChanged" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "effectOnResults" TEXT,
    "plannedActivityId" TEXT,
    "indicatorId" TEXT,
    "reportingPeriodId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAdaptation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectAdaptation_tenantId_idx" ON "ProjectAdaptation"("tenantId");
CREATE INDEX "ProjectAdaptation_projectId_recordedOn_idx" ON "ProjectAdaptation"("projectId", "recordedOn");
