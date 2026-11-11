-- Phase 50.3b: what kind of facility a place is (OTP, SC, a school…). Additive and nullable.
ALTER TABLE "Place" ADD COLUMN "facilityType" TEXT;
-- The organisation's own list of facility types (Phase 50.3b).
ALTER TABLE "Organization" ADD COLUMN "facilityTypesJson" JSONB NOT NULL DEFAULT '[]';
