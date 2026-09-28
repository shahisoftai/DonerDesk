-- Report section hierarchy: each report section keeps the depth (1-4) and
-- donor numbering of the template section it was planned from, so the
-- Reporting Workspace outline and exports can show sections and sub-sections
-- as a table of contents. Additive only; existing sections default to level 1.

ALTER TABLE "ReportSection" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ReportSection" ADD COLUMN "numbering" TEXT;
ALTER TABLE "ReportSection" ADD COLUMN "templateSectionId" TEXT;
