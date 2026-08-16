-- Feature: Per-project team assignments.
-- Creates the ProjectMember table (tenant-scoped) backing the project Team tab.
-- Unique (tenantId, projectId, userId) keeps one active assignment per member.

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_tenantId_projectId_userId_key"
  ON "ProjectMember"("tenantId", "projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectMember_tenantId_projectId_idx"
  ON "ProjectMember"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_tenantId_userId_idx"
  ON "ProjectMember"("tenantId", "userId");
