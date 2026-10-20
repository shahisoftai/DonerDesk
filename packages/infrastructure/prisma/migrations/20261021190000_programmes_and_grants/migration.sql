-- Funding hierarchy: programme > grant > project. Donor stays free text on the project; a grant makes it a record.
ALTER TABLE "Project" ADD COLUMN "programmeId" TEXT;
ALTER TABLE "Project" ADD COLUMN "grantId" TEXT;

CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeId" TEXT,
    "title" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "awardNumber" TEXT,
    "amount" TEXT,
    "currency" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Programme_tenantId_name_key" ON "Programme"("tenantId", "name");
CREATE INDEX "Programme_tenantId_idx" ON "Programme"("tenantId");
CREATE INDEX "Grant_tenantId_idx" ON "Grant"("tenantId");
CREATE INDEX "Grant_tenantId_programmeId_idx" ON "Grant"("tenantId", "programmeId");
