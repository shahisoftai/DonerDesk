-- Phase 28.1-J: how many planned activities a person can lead in a week (blank = no limit). Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds MemberCapacity; RLS forced).
CREATE TABLE "MemberCapacity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activitiesPerWeek" INTEGER,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberCapacity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberCapacity_tenantId_userId_key" ON "MemberCapacity"("tenantId", "userId");
