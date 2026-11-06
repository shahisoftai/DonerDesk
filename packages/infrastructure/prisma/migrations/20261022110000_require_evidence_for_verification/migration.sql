-- Optional per project: an indicator value needs an attached file before it can be verified.
ALTER TABLE "ReportingProfile" ADD COLUMN "requireEvidenceForVerification" BOOLEAN NOT NULL DEFAULT false;
