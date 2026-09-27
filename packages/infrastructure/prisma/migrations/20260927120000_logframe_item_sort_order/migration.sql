-- Logframe item ordering among siblings (drag-and-drop reorder). Additive:
-- existing rows get 0, which keeps today's level/code ordering until a user
-- reorders a sibling group (the move handler then numbers it densely 0..n-1).

-- AlterTable
ALTER TABLE "LogframeItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
