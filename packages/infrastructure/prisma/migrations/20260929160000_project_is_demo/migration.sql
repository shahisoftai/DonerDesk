-- Feature 22 (DonorDesk Academy): mark seeded demo/tour projects so they are
-- excluded from plan-limit and AI-credit usage counts.
ALTER TABLE "Project" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Project_tenantId_isDemo_idx" ON "Project"("tenantId", "isDemo");
