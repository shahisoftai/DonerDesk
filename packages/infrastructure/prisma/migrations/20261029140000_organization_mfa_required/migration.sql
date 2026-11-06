-- Organisation-wide requirement for two-step sign-in, from a chosen moment (Phase 33.12). Null = optional. Additive.
ALTER TABLE "Organization" ADD COLUMN "mfaRequiredFrom" TIMESTAMP(3);
