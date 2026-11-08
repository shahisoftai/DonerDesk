-- Sector library (phase 46): which library entry an indicator was copied from, and an organisation's own use of the library.
ALTER TABLE "Indicator" ADD COLUMN "libraryId" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "libraryVersion" INTEGER;
ALTER TABLE "Indicator" ADD COLUMN "libraryJson" TEXT;

CREATE TABLE "OrganisationLibraryEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "libraryVersion" INTEGER,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationLibraryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganisationLibraryEntry_tenantId_entryId_kind_key" ON "OrganisationLibraryEntry"("tenantId", "entryId", "kind");
CREATE INDEX "OrganisationLibraryEntry_tenantId_idx" ON "OrganisationLibraryEntry"("tenantId");
