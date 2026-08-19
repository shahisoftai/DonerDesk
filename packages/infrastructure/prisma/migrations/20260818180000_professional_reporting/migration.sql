-- Professional donor reporting: revision integrity, requirement packs, and
-- submission snapshots.

-- ReportRevision: immutable content revisions with assurance state.
CREATE TABLE "ReportRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "parentRevisionId" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changeOrigin" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "modelId" TEXT,
    "promptVersion" INTEGER,
    "generationRunId" TEXT,
    "assuranceState" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportRevision_tenantId_sectionId_revisionNumber_key"
    ON "ReportRevision"("tenantId", "sectionId", "revisionNumber");

CREATE INDEX "ReportRevision_tenantId_idx" ON "ReportRevision"("tenantId");
CREATE INDEX "ReportRevision_draftId_idx" ON "ReportRevision"("draftId");
CREATE INDEX "ReportRevision_sectionId_idx" ON "ReportRevision"("sectionId");

ALTER TABLE "ReportSection" ADD COLUMN "currentRevisionId" TEXT;

-- SubmissionSnapshot: immutable donor-submission boundary.
CREATE TABLE "SubmissionSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDraftId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SEALED',
    "propsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubmissionSnapshot_tenantId_idx" ON "SubmissionSnapshot"("tenantId");
CREATE INDEX "SubmissionSnapshot_reportDraftId_idx" ON "SubmissionSnapshot"("reportDraftId");
CREATE INDEX "SubmissionSnapshot_reportingPeriodId_idx" ON "SubmissionSnapshot"("reportingPeriodId");

-- ReportingRequirementPack: versioned typed requirement definitions.
CREATE TABLE "ReportingRequirementPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "donorKey" TEXT NOT NULL,
    "mechanismKey" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'en',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requirementsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingRequirementPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportingRequirementPack_tenantId_donorKey_mechanismKey_reportTyp_key"
    ON "ReportingRequirementPack"("tenantId", "donorKey", "mechanismKey", "reportType", "version");

CREATE INDEX "ReportingRequirementPack_tenantId_idx" ON "ReportingRequirementPack"("tenantId");
CREATE INDEX "ReportingRequirementPack_donorKey_mechanismKey_reportType_idx"
    ON "ReportingRequirementPack"("donorKey", "mechanismKey", "reportType");

-- AwardReportingOverride: award-specific differences with precedence over packs.
CREATE TABLE "AwardReportingOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "documentHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requirementsJson" TEXT NOT NULL,
    "sourceReferenceJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardReportingOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AwardReportingOverride_tenantId_projectId_awardId_version_key"
    ON "AwardReportingOverride"("tenantId", "projectId", "awardId", "version");

CREATE INDEX "AwardReportingOverride_tenantId_idx" ON "AwardReportingOverride"("tenantId");
CREATE INDEX "AwardReportingOverride_projectId_idx" ON "AwardReportingOverride"("projectId");

-- ResolvedReportingRequirements: immutable per-period resolved snapshot.
CREATE TABLE "ResolvedReportingRequirements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "generationRunId" TEXT,
    "snapshotJson" TEXT NOT NULL,
    "sourceTraceJson" TEXT NOT NULL,
    "coverageJson" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolvedReportingRequirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResolvedReportingRequirements_tenantId_idx" ON "ResolvedReportingRequirements"("tenantId");
CREATE INDEX "ResolvedReportingRequirements_reportingPeriodId_idx" ON "ResolvedReportingRequirements"("reportingPeriodId");

-- ReportClaim: revision-bound assertions.
ALTER TABLE "ReportClaim" ADD COLUMN "revisionId" TEXT;
ALTER TABLE "ReportClaim" ADD COLUMN "revisionHash" TEXT;
ALTER TABLE "ReportClaim" ADD COLUMN "charStart" INTEGER;
ALTER TABLE "ReportClaim" ADD COLUMN "charEnd" INTEGER;
ALTER TABLE "ReportClaim" ADD COLUMN "numericAtomsJson" TEXT;
ALTER TABLE "ReportClaim" ADD COLUMN "verificationReasonCode" TEXT;
ALTER TABLE "ReportClaim" ADD COLUMN "assertionType" TEXT;
ALTER TABLE "ReportClaim" ADD COLUMN "materiality" TEXT;

CREATE INDEX "ReportClaim_revisionId_idx" ON "ReportClaim"("revisionId");

-- ExportPackage: export intent + submission snapshot binding.
ALTER TABLE "ExportPackage" ADD COLUMN "exportIntent" TEXT NOT NULL DEFAULT 'INTERNAL_REVIEW';
ALTER TABLE "ExportPackage" ADD COLUMN "submissionSnapshotId" TEXT;

-- Baseline revision backfill: every existing section that predates the
-- ReportRevision model gets a single UNASSESSED baseline revision and its
-- existing claims are bound to it. The content hash uses md5() as a
-- deterministic placeholder because SHA-256 of normalized content cannot be
-- reproduced in SQL; assurance is UNASSESSED, so the placeholder is never
-- trusted as current and is superseded by a SHA-256 revision on the next
-- edit or re-assessment. Idempotent: sections that already have a
-- currentRevisionId are skipped.
INSERT INTO "ReportRevision" (
  "id", "tenantId", "draftId", "sectionId", "revisionNumber",
  "parentRevisionId", "content", "contentHash", "changeOrigin",
  "actorId", "assuranceState", "createdAt", "updatedAt"
)
SELECT
  'rev-baseline-' || s."id",
  s."tenantId",
  s."reportDraftId",
  s."id",
  1,
  NULL,
  s."content",
  md5(s."content"),
  'GENERATION',
  'system-backfill',
  'UNASSESSED',
  now(),
  now()
FROM "ReportSection" s
WHERE s."currentRevisionId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "ReportSection" s
SET "currentRevisionId" = 'rev-baseline-' || s."id"
WHERE s."currentRevisionId" IS NULL;

-- Bind existing claims to their section's baseline revision.
UPDATE "ReportClaim" c
SET "revisionId" = s."currentRevisionId",
    "revisionHash" = md5(s."content")
FROM "ReportSection" s
WHERE c."sectionId" = s."id"
  AND c."revisionId" IS NULL
  AND s."currentRevisionId" IS NOT NULL;
