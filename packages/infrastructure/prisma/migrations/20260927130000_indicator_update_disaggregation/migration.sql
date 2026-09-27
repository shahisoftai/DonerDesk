-- Disaggregated indicator values (e.g. by sex / age group) stored with the
-- update they break down. Additive: existing rows get an empty breakdown.

-- AlterTable
ALTER TABLE "IndicatorUpdate" ADD COLUMN "disaggregationJson" TEXT NOT NULL DEFAULT '[]';
