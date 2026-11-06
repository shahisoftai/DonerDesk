-- A value may be answered "not applicable" for a period, with a reason (Phase 33.3). Additive.
ALTER TABLE "IndicatorUpdate" ADD COLUMN "notApplicableReason" TEXT;
