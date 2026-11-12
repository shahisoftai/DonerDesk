-- Phase 52.0: what the donor calls the levels of the results chain. Additive; {} reads as the default words.
ALTER TABLE "ReportingProfile" ADD COLUMN "vocabularyJson" TEXT NOT NULL DEFAULT '{}';
