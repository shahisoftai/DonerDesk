-- Optional per-project IANA time zone (absent = the organisation zone). Additive.
ALTER TABLE "Project" ADD COLUMN "timeZone" TEXT;
