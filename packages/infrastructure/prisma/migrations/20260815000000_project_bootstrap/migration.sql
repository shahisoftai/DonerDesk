-- Feature 18: Project Creation Wizard (bootstrap -> reporting-ready)
-- Adds tenant-scoped project workspace provisioning, the reporting profile,
-- and immutable reporting-period snapshots.

-- Organization: tenant-level DonorDesk Drive root folder
ALTER TABLE "Organization" ADD COLUMN "driveRootFolderId" TEXT;

-- Project: per-project workspace root + unique project code per tenant.
-- Deduplicate legacy project codes before applying the uniqueness constraint.
DO $$
DECLARE
  r RECORD;
  dup RECORD;
  n INT;
BEGIN
  FOR r IN
    SELECT "tenantId", "projectCode"
    FROM "Project"
    GROUP BY "tenantId", "projectCode"
    HAVING COUNT(*) > 1
    ORDER BY "tenantId", "projectCode"
  LOOP
    n := 1;
    FOR dup IN
      SELECT id FROM "Project"
      WHERE "tenantId" = r."tenantId" AND "projectCode" = r."projectCode"
      ORDER BY "createdAt"
      OFFSET 1
    LOOP
      UPDATE "Project"
      SET "projectCode" = r."projectCode" || '-' || n
      WHERE id = dup.id;
      n := n + 1;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "Project" ADD COLUMN "workspaceRootId" TEXT;
CREATE UNIQUE INDEX "Project_tenantId_projectCode_key" ON "Project"("tenantId", "projectCode");
CREATE INDEX "Project_tenantId_id_idx" ON "Project"("tenantId", "id");

-- ProjectSetup: workspace provisioning operational state
CREATE TABLE "ProjectSetup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceProvisionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "workspaceProvisionError" TEXT,
    "provisionAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastProvisionAttemptAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectSetup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectSetup_projectId_key" ON "ProjectSetup"("projectId");
CREATE INDEX "ProjectSetup_tenantId_projectId_idx" ON "ProjectSetup"("tenantId", "projectId");
CREATE INDEX "ProjectSetup_workspaceProvisionStatus_idx" ON "ProjectSetup"("workspaceProvisionStatus");

ALTER TABLE "ProjectSetup" ADD CONSTRAINT "ProjectSetup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ReportingProfile: per-project authoritative writing behavior
CREATE TABLE "ReportingProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "defaultTemplateId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "tone" TEXT NOT NULL DEFAULT 'FORMAL',
    "writingStyle" TEXT,
    "audienceNotes" TEXT,
    "formattingRulesJson" TEXT NOT NULL DEFAULT '[]',
    "specialRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "sectionOverridesJson" TEXT NOT NULL DEFAULT '{}',
    "deadlineOffsetDays" INTEGER,
    "autoPeriodCreation" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportingProfile_projectId_key" ON "ReportingProfile"("projectId");
CREATE INDEX "ReportingProfile_tenantId_projectId_idx" ON "ReportingProfile"("tenantId", "projectId");

ALTER TABLE "ReportingProfile" ADD CONSTRAINT "ReportingProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ReportingPeriod: immutable effective snapshots (template + profile) so later
-- edits never alter existing reports.
ALTER TABLE "ReportingPeriod" ADD COLUMN "reportingProfileSnapshotJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ReportingPeriod" ADD COLUMN "templateSnapshotJson" TEXT NOT NULL DEFAULT '{}';
