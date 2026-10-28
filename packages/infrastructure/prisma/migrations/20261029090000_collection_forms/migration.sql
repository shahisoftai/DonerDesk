-- Collection forms, records and anonymous collection links (Phase 33.5). Additive.
CREATE TABLE "CollectionForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definitionJson" TEXT NOT NULL DEFAULT '{"fields":[]}',
    "mappingsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionForm_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionForm_tenantId_projectId_idx" ON "CollectionForm"("tenantId", "projectId");

CREATE TABLE "CollectionRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "submittedOn" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "submittedById" TEXT,
    "submitterName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionRecord_tenantId_formId_status_idx" ON "CollectionRecord"("tenantId", "formId", "status");

CREATE TABLE "CollectionLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectionLink_tokenHash_key" ON "CollectionLink"("tokenHash");
CREATE INDEX "CollectionLink_tenantId_formId_idx" ON "CollectionLink"("tenantId", "formId");
