-- Account-wide default reporting profile (seeds every new project's
-- ReportingProfile). Part of the Onboarding wizard restructure (2026-08-15).
ALTER TABLE "Organization" ADD COLUMN "reportingDefaults" TEXT NOT NULL DEFAULT '{}';
