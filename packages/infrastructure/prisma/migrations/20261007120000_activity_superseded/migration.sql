-- A withdrawn activity record can name the record that replaced it. The status column is free text, so
-- WITHDRAWN needs no schema change.
ALTER TABLE "ActivityUpdate" ADD COLUMN "supersededById" TEXT;
