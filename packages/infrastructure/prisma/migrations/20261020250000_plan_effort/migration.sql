-- Phase 28.1-J: how heavy a planned activity is for its lead (1 to 5), summed by the workload view. Additive; every existing row is 1.
ALTER TABLE "PlannedActivity" ADD COLUMN "effort" INTEGER NOT NULL DEFAULT 1;
