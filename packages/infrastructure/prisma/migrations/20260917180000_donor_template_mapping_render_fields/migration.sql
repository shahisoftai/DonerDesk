-- Donor template rendering (docxtpl) — additive columns on the existing
-- DonorTemplateMapping model. No new table, no data loss.
-- detectedRegionsJson caches the raw structural parse (headings/tables
-- detected from the donor's uploaded DOCX) alongside the approved mapping so
-- a mapping can be re-reviewed without reparsing the original file.
-- templatedFileUrl points at the placeholder-inserted DOCX produced once, at
-- mapping-approval time, and reused for every export against a locked
-- reporting period (never reparsed per export).

-- AlterTable
ALTER TABLE "DonorTemplateMapping" ADD COLUMN "detectedRegionsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "DonorTemplateMapping" ADD COLUMN "templatedFileUrl" TEXT;
