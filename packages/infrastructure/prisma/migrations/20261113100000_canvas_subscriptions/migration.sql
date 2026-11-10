-- A person's own subscription to a canvas: told weekly or monthly that it is ready to open (Phase 48.16). Additive.
CREATE TABLE "CanvasSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "every" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanvasSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CanvasSubscription_canvasId_userId_key" ON "CanvasSubscription"("canvasId", "userId");
CREATE INDEX "CanvasSubscription_tenantId_userId_idx" ON "CanvasSubscription"("tenantId", "userId");
