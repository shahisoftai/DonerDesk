-- Phase 25.1: store why a section was not written by the AI, so the editor can say so and offer the right retry.
ALTER TABLE "ReportSection" ADD COLUMN IF NOT EXISTS "generationFallbackReason" TEXT;
ALTER TABLE "ReportSection" ADD COLUMN IF NOT EXISTS "generationFallbackDetail" TEXT;
