-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "EvidenceFile" ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveWebLink" TEXT,
ADD COLUMN     "storageKey" TEXT;
