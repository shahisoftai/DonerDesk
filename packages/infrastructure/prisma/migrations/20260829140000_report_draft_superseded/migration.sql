-- One working draft per reporting period (product recovery P0-6).
-- Additive column; no data migration. Drafts that are superseded by a newer
-- generation are hidden from the workspace while approved/exported/submitted
-- drafts remain the historical record.

ALTER TABLE "ReportDraft" ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE INDEX "ReportDraft_supersededAt_idx" ON "ReportDraft"("supersededAt");
