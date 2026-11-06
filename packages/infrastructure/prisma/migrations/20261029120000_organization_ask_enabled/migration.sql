-- Opt-in for Ask DonorDesk (Phase 33.9). Off for every organisation until an administrator turns it on. Additive.
ALTER TABLE "Organization" ADD COLUMN "askEnabled" BOOLEAN NOT NULL DEFAULT false;
