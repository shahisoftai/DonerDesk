-- Phase 28.1-B: a target for each breakdown category of an indicator (JSON list of dimension/category/value). Additive only.
ALTER TABLE "Indicator" ADD COLUMN "targetBreakdownsJson" TEXT;
