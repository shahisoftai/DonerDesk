-- A place can be marked as a facility (a clinic, a school, a water point): a flag on the place, nothing else changes. Additive.
ALTER TABLE "Place" ADD COLUMN "facility" BOOLEAN NOT NULL DEFAULT false;
