-- Phase 41.6: a place that is an area may carry a drawn outline or route. The shape is a GeoJSON file in storage;
-- the row keeps only what it is, where the file is and how big. Additive: every column is nullable, nothing is rewritten.
ALTER TABLE "Place" ADD COLUMN "geometryKind" TEXT;
ALTER TABLE "Place" ADD COLUMN "geometryKey" TEXT;
ALTER TABLE "Place" ADD COLUMN "geometryBytes" INTEGER;
ALTER TABLE "Place" ADD COLUMN "placedBy" TEXT;
