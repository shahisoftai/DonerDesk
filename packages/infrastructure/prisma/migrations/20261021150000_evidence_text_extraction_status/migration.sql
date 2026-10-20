-- Whether an evidence file's words were actually read. A scanned or damaged file used to end up with no text and no
-- sign of it, so a person believed the content was in the system. Null = extraction not attempted (or not reported) yet.
ALTER TABLE "EvidenceFile" ADD COLUMN "textExtractionStatus" TEXT;
ALTER TABLE "EvidenceFile" ADD COLUMN "textExtractionNote" TEXT;

-- Files whose text is already stored were read.
UPDATE "EvidenceFile" SET "textExtractionStatus" = 'EXTRACTED' WHERE "extractedText" IS NOT NULL AND length(trim("extractedText")) > 0;
