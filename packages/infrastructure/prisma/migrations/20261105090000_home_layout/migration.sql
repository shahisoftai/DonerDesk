-- How a person has arranged the panels of their Home (Phase 40): order, width and hidden flags, never data. Additive.
CREATE TABLE "HomeLayout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "layoutJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeLayout_tenantId_userId_variant_key" ON "HomeLayout"("tenantId", "userId", "variant");
CREATE INDEX "HomeLayout_tenantId_userId_idx" ON "HomeLayout"("tenantId", "userId");
