-- Photos and documents attached to collection-form answers (Phase 33.5). Additive.
CREATE TABLE "CollectionFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionFile_tenantId_formId_idx" ON "CollectionFile"("tenantId", "formId");
