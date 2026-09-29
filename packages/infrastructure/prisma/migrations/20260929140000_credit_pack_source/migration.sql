-- Phase 22 WS-D (§2.1e follow-up): distinguish a regular top-up pack from a
-- Growth-only prepaid standing balance, and add the SUSPENDED terminal state
-- for a standing-balance pack that stops drawing down on downgrade/cancellation.
ALTER TABLE "PurchasedCreditPack" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'TOPUP';

CREATE INDEX "PurchasedCreditPack_tenantId_source_status_idx" ON "PurchasedCreditPack"("tenantId", "source", "status");
