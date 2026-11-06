-- Optional per project: saving an indicator value hands it in at once (and verifies it when the saver may verify and a file is attached). Additive.
ALTER TABLE "ReportingProfile" ADD COLUMN "simpleReview" BOOLEAN NOT NULL DEFAULT false;
