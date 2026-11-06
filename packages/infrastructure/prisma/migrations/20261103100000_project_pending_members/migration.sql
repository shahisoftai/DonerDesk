-- Phase 38.9c: people named in a project setup who had no account yet, and what they are to own once they join (additive).
CREATE TABLE "ProjectPendingMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "responsibilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPendingMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectPendingMember_tenantId_projectId_email_key" ON "ProjectPendingMember"("tenantId", "projectId", "email");
CREATE INDEX "ProjectPendingMember_tenantId_email_idx" ON "ProjectPendingMember"("tenantId", "email");
