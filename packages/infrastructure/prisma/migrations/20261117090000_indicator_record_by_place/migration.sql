-- Phase 53.2: an indicator may be recorded one figure per place. Additive.
ALTER TABLE "Indicator" ADD COLUMN "recordByPlace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Indicator" ADD COLUMN "placeLevel" INTEGER;
