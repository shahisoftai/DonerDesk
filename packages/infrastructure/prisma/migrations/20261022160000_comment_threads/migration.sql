ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT,
ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
