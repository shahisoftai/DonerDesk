-- A recorded activity can point at the logframe's own ACTIVITY node, so the logframe shows delivery.
ALTER TABLE "ActivityUpdate" ADD COLUMN "logframeActivityId" TEXT;
CREATE INDEX "ActivityUpdate_logframeActivityId_idx" ON "ActivityUpdate"("logframeActivityId");
