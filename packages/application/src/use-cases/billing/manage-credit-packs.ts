import { randomUUID } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError, PurchasedCreditPack, TenantId } from "@donordesk/domain";
import type { PurchasedCreditPackSource } from "@donordesk/domain";
import type { IPurchasedCreditPackRepository } from "../../ports/billing.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";

export interface CreditPackSummary {
  id: string;
  tenantId: string;
  credits: number;
  used: number;
  remaining: number;
  status: string;
  source: string;
  providerOrderId: string | null;
  purchasedAt: string;
  expiresAt: string | null;
}

function toSummary(pack: PurchasedCreditPack): CreditPackSummary {
  return {
    id: pack.id,
    tenantId: pack.tenantId,
    credits: pack.credits,
    used: pack.used,
    remaining: pack.remaining,
    status: pack.status,
    source: pack.source,
    providerOrderId: pack.providerOrderId ?? null,
    purchasedAt: pack.purchasedAt.toISOString(),
    expiresAt: pack.expiresAt?.toISOString() ?? null,
  };
}

/** SuperAdmin read of every credit pack (any status) for one tenant. */
export class ListCreditPacksHandler {
  constructor(private readonly packs: IPurchasedCreditPackRepository) {}

  async handle(tenantId: string): Promise<Result<CreditPackSummary[], DomainError>> {
    const result = await this.packs.listByTenant(tenantId);
    if (!result.ok) return result;
    return { ok: true, value: result.value.map(toSummary) };
  }
}

/**
 * Phase 22 WS-K item 2 (write half): grants a comped/goodwill pack with
 * `providerOrderId: null` — no Creem order backs it, it's a platform-level
 * gift of `credits` AI-draft credits. Draws down exactly like a purchased
 * pack (oldest-first, per `EntitlementService`/`reserveFromPacks`); nothing
 * about the reservation/draw-down path needed to change since packs were
 * always designed to allow a null `providerOrderId` (see
 * `packages/domain/src/contexts/billing/purchased-credit-pack.ts`).
 * Takes a raw actor id (SuperAdmin session, not a tenant `AuthenticatedContext`)
 * following `ApproveNonprofitVerificationHandler`'s precedent.
 */
export class CompCreditPackHandler {
  constructor(
    private readonly packs: IPurchasedCreditPackRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(actorId: string, input: { tenantId: string; credits: number; source?: PurchasedCreditPackSource; reason?: string }): Promise<Result<CreditPackSummary, DomainError>> {
    if (!Number.isInteger(input.credits) || input.credits <= 0) {
      return { ok: false, error: DomainError.validation("Comped credits must be a positive integer") };
    }
    if (input.source !== undefined && input.source !== "TOPUP" && input.source !== "GROWTH_STANDING_BALANCE") {
      return { ok: false, error: DomainError.validation("Comped pack source must be TOPUP or GROWTH_STANDING_BALANCE") };
    }
    let pack: PurchasedCreditPack;
    try {
      pack = PurchasedCreditPack.create({
        id: randomUUID(),
        props: {
          tenantId: input.tenantId,
          credits: input.credits,
          source: input.source ?? "TOPUP",
          providerOrderId: undefined,
          purchasedAt: this.clock.now(),
        },
      });
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const created = await this.packs.create(pack);
    if (!created.ok) return created;

    await this.audit.record({
      tenantId: TenantId.create(input.tenantId),
      actorId,
      eventType: "billing.credits.pack_comped",
      entityType: "purchased_credit_pack",
      entityId: created.value.id,
      newValue: JSON.stringify({ credits: input.credits, source: pack.source, reason: input.reason ?? null }),
    });
    return { ok: true, value: toSummary(created.value) };
  }
}

/**
 * Phase 22 WS-K item 2 (write half): manually flips a pack to REFUNDED
 * outside the Creem webhook path (e.g. a goodwill comp being walked back, or
 * a refund/dispute event that never made it through Creem's webhook). Mirrors
 * `ProcessBillingWebhookHandler`'s refund handling — never claws back credits
 * already consumed (`PurchasedCreditPack.refund()`), only stops future
 * draw-down.
 */
export class RefundCreditPackHandler {
  constructor(
    private readonly packs: IPurchasedCreditPackRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(actorId: string, input: { tenantId: string; packId: string; reason?: string }): Promise<Result<CreditPackSummary, DomainError>> {
    const found = await this.packs.listByTenant(input.tenantId);
    if (!found.ok) return found;
    const pack = found.value.find((p) => p.id === input.packId);
    if (!pack) return { ok: false, error: DomainError.notFound("PurchasedCreditPack", input.packId) };

    try {
      pack.refund();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const updated = await this.packs.update(pack);
    if (!updated.ok) return updated;

    await this.audit.record({
      tenantId: TenantId.create(input.tenantId),
      actorId,
      eventType: "billing.credits.pack_refunded",
      entityType: "purchased_credit_pack",
      entityId: pack.id,
      newValue: JSON.stringify({ reason: input.reason ?? null }),
    });
    return { ok: true, value: toSummary(updated.value) };
  }
}
