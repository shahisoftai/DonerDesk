-- Donor Template Manager v2: structured requirements, lifecycle status,
-- extraction provenance, original-file metadata, library reuse, and an
-- immutable per-version snapshot table. Additive only; existing templates
-- default to REVIEWED so reports already using them keep generating.

ALTER TABLE "DonorTemplate" ADD COLUMN "requirementsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "DonorTemplate" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'REVIEWED';
ALTER TABLE "DonorTemplate" ADD COLUMN "extractionMetaJson" TEXT;
ALTER TABLE "DonorTemplate" ADD COLUMN "originalFileName" TEXT;
ALTER TABLE "DonorTemplate" ADD COLUMN "originalFileMime" TEXT;
ALTER TABLE "DonorTemplate" ADD COLUMN "originalFileHash" TEXT;
ALTER TABLE "DonorTemplate" ADD COLUMN "isLibrary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DonorTemplate" ADD COLUMN "sourceTemplateId" TEXT;
CREATE INDEX "DonorTemplate_tenantId_isLibrary_idx" ON "DonorTemplate"("tenantId", "isLibrary");

CREATE TABLE "DonorTemplateVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sectionsJson" TEXT NOT NULL,
    "requirementsJson" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonorTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DonorTemplateVersion_templateId_version_key" ON "DonorTemplateVersion"("templateId", "version");
CREATE INDEX "DonorTemplateVersion_tenantId_idx" ON "DonorTemplateVersion"("tenantId");
ALTER TABLE "DonorTemplateVersion" ADD CONSTRAINT "DonorTemplateVersion_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "DonorTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: annexes move into structured requirements; every template gets a
-- snapshot of its current version so pinned periods can resolve it.
UPDATE "DonorTemplate"
SET "requirementsJson" = json_build_object(
  'annexes', COALESCE((SELECT json_agg(json_build_object('name', a, 'required', true)) FROM json_array_elements_text(NULLIF("requiredAnnexes", '')::json) AS a), '[]'::json)
)::text
WHERE "requirementsJson" = '{}';

INSERT INTO "DonorTemplateVersion" ("id", "tenantId", "templateId", "version", "sectionsJson", "requirementsJson", "createdById", "changeNote")
SELECT gen_random_uuid()::text, "tenantId", "id", "version", "sectionsJson", "requirementsJson", "uploadedById", 'Backfilled on v2 migration'
FROM "DonorTemplate"
ON CONFLICT ("templateId", "version") DO NOTHING;

-- Tenant isolation: DonorTemplateVersion is listed in infra/postgres/rls.sql;
-- re-apply that script after this migration.
