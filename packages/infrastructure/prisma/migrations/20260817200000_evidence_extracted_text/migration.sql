-- Persist the raw document text extracted from evidence files (e.g. Tika OCR)
-- so report generation can cite the real content, not just the AI summary.

-- AlterTable
ALTER TABLE "EvidenceFile" ADD COLUMN     "extractedText" TEXT;
