-- Assessments and long surveys (Phase 62). Additive.
ALTER TABLE "CollectionRecord" ADD COLUMN "placeId" TEXT;
ALTER TABLE "CollectionRecord" ADD COLUMN "visitNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CollectionRecord" ADD COLUMN "answersVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CollectionRecord" ADD COLUMN "howJson" TEXT;
ALTER TABLE "CollectionRecord" ADD COLUMN "flagsJson" TEXT;
ALTER TABLE "CollectionRecord" ADD COLUMN "scoreJson" TEXT;
ALTER TABLE "CollectionRecord" ADD COLUMN "startedAt" TIMESTAMP(3);
CREATE INDEX "CollectionRecord_tenantId_formId_placeId_idx" ON "CollectionRecord"("tenantId", "formId", "placeId");

CREATE TABLE "CollectionDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeKey" TEXT NOT NULL DEFAULT '',
    "answersJson" TEXT NOT NULL,
    "howJson" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectionDraft_tenantId_formId_userId_placeKey_key" ON "CollectionDraft"("tenantId", "formId", "userId", "placeKey");
CREATE INDEX "CollectionDraft_tenantId_userId_idx" ON "CollectionDraft"("tenantId", "userId");

CREATE TABLE "CollectionAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueOn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TO_DO',
    "reason" TEXT,
    "recordId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectionAssignment_tenantId_formId_placeId_key" ON "CollectionAssignment"("tenantId", "formId", "placeId");
CREATE INDEX "CollectionAssignment_tenantId_assigneeId_status_idx" ON "CollectionAssignment"("tenantId", "assigneeId", "status");
CREATE INDEX "CollectionAssignment_tenantId_projectId_idx" ON "CollectionAssignment"("tenantId", "projectId");
