-- A person's own shortcuts to pages in the app: a title and an in-app address, never data (Phase 34.7). Additive.
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bookmark_tenantId_userId_idx" ON "Bookmark"("tenantId", "userId");
