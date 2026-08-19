-- Baseline revision backfill (Phase 1): every existing section that predates
-- the ReportRevision model gets a single UNASSESSED baseline revision and its
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
