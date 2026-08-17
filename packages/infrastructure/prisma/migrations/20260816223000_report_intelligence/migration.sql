-- Feature 20: Report Intelligence Engine
-- Indicator semantics, locked donor template mapping on periods, and the
-- plan/claim/generation-run/mapping persistence models.

-- AlterTable
ALTER TABLE "Indicator" ADD COLUMN     "semanticsJson" TEXT;

-- AlterTable
ALTER TABLE "ReportingPeriod" ADD COLUMN     "donorTemplateMappingId" TEXT,
ADD COLUMN     "donorTemplateVersion" INTEGER;

-- CreateTable
CREATE TABLE "ReportPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "styleJson" TEXT NOT NULL DEFAULT '{}',
    "generatedBy" TEXT NOT NULL DEFAULT 'INFERRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDraftId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL DEFAULT '[]',
    "verificationResult" TEXT NOT NULL DEFAULT 'FAILED',
    "verificationDetail" TEXT NOT NULL DEFAULT '',
    "resolutionNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportGenerationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorTemplateMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "regionsJson" TEXT NOT NULL DEFAULT '[]',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorTemplateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportPlan_tenantId_idx" ON "ReportPlan"("tenantId");

-- CreateIndex
CREATE INDEX "ReportPlan_reportingPeriodId_idx" ON "ReportPlan"("reportingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPlan_tenantId_reportingPeriodId_version_key" ON "ReportPlan"("tenantId", "reportingPeriodId", "version");

-- CreateIndex
CREATE INDEX "ReportClaim_tenantId_idx" ON "ReportClaim"("tenantId");

-- CreateIndex
CREATE INDEX "ReportClaim_reportDraftId_idx" ON "ReportClaim"("reportDraftId");

-- CreateIndex
CREATE INDEX "ReportClaim_sectionId_idx" ON "ReportClaim"("sectionId");

-- CreateIndex
CREATE INDEX "ReportGenerationRun_tenantId_idx" ON "ReportGenerationRun"("tenantId");

-- CreateIndex
CREATE INDEX "ReportGenerationRun_reportingPeriodId_idx" ON "ReportGenerationRun"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "ReportGenerationRun_draftId_idx" ON "ReportGenerationRun"("draftId");

-- CreateIndex
CREATE INDEX "DonorTemplateMapping_tenantId_idx" ON "DonorTemplateMapping"("tenantId");

-- CreateIndex
CREATE INDEX "DonorTemplateMapping_templateId_idx" ON "DonorTemplateMapping"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "DonorTemplateMapping_tenantId_templateId_version_key" ON "DonorTemplateMapping"("tenantId", "templateId", "version");

-- AddForeignKey
ALTER TABLE "ReportPlan" ADD CONSTRAINT "ReportPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPlan" ADD CONSTRAINT "ReportPlan_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportClaim" ADD CONSTRAINT "ReportClaim_reportDraftId_fkey" FOREIGN KEY ("reportDraftId") REFERENCES "ReportDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportClaim" ADD CONSTRAINT "ReportClaim_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportGenerationRun" ADD CONSTRAINT "ReportGenerationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportGenerationRun" ADD CONSTRAINT "ReportGenerationRun_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportGenerationRun" ADD CONSTRAINT "ReportGenerationRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ReportDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
