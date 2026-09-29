import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type PurchasedCreditPackStatus = "ACTIVE" | "EXHAUSTED" | "REFUNDED" | "SUSPENDED";

/**
 * `TOPUP` — a regular one-off purchase (§4 WS-D item 3/4); tenant property
 * that survives a downgrade/cancellation and keeps drawing down against
 * whatever plan is active.
 * `GROWTH_STANDING_BALANCE` — Growth-only prepaid soft-overage balance (§4
 * WS-D item 5); exempt from the survival rule above — a downgrade away from
 * GROWTH suspends it (see `suspendForDowngrade()`).
 */
export type PurchasedCreditPackSource = "TOPUP" | "GROWTH_STANDING_BALANCE";

/** §4 WS-D item 5: a Growth tenant may hold up to this many ACTIVE standing-balance packs. */
export const MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS = 2;

export interface PurchasedCreditPackProps {
  tenantId: string;
  credits: number;
  used: number;
  status: PurchasedCreditPackStatus;
  /** Defaults to "TOPUP" for backward compatibility with pre-existing packs/callers. */
  source: PurchasedCreditPackSource;
  providerOrderId?: string;
  purchasedAt: Date;
  expiresAt?: Date;
}

/**
 * A one-off AI-credit top-up purchase. Draws down after the tenant's monthly
 * plan allowance is exhausted, oldest-first (see EntitlementService). Refunds
 * stop further draw-down but never claw back credits already consumed —
 * mirrors Feature 19's "refund never deletes data" principle.
 */
export class PurchasedCreditPack extends Entity<string> {
  private constructor(
    id: string,
    private props: PurchasedCreditPackProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    props: Omit<PurchasedCreditPackProps, "used" | "status" | "source"> & { source?: PurchasedCreditPackSource };
  }): PurchasedCreditPack {
    PurchasedCreditPack.validate(input.props);
    return new PurchasedCreditPack(input.id, {
      ...input.props,
      used: 0,
      status: "ACTIVE",
      source: input.props.source ?? "TOPUP",
    });
  }

  static rehydrate(input: { id: string; props: PurchasedCreditPackProps; createdAt: Date }): PurchasedCreditPack {
    PurchasedCreditPack.validate(input.props);
    return new PurchasedCreditPack(input.id, input.props, input.createdAt);
  }

  private static validate(p: { tenantId: string; credits: number }): void {
    if (!p.tenantId) throw DomainError.validation("Tenant ID required");
    if (!Number.isInteger(p.credits) || p.credits <= 0) throw DomainError.validation("Pack credits must be a positive integer");
  }

  get tenantId(): string { return this.props.tenantId; }
  get credits(): number { return this.props.credits; }
  get used(): number { return this.props.used; }
  get status(): PurchasedCreditPackStatus { return this.props.status; }
  get source(): PurchasedCreditPackSource { return this.props.source; }
  get providerOrderId(): string | undefined { return this.props.providerOrderId; }
  get purchasedAt(): Date { return this.props.purchasedAt; }
  get expiresAt(): Date | undefined { return this.props.expiresAt; }
  get remaining(): number { return Math.max(0, this.props.credits - this.props.used); }

  /** Draws down `amount` credits, marking the pack EXHAUSTED once fully spent. */
  consume(amount: number): void {
    if (this.props.status !== "ACTIVE") throw DomainError.invalidTransition(`Cannot draw down a ${this.props.status} pack`);
    if (this.remaining < amount) throw DomainError.invariant("Pack does not have enough remaining credits");
    this.props.used += amount;
    if (this.props.used >= this.props.credits) this.props.status = "EXHAUSTED";
    this.touch();
  }

  /** Compensating release for a failed generation after a successful reserve. */
  release(amount: number): void {
    this.props.used = Math.max(0, this.props.used - amount);
    if (this.props.status === "EXHAUSTED" && this.props.used < this.props.credits) this.props.status = "ACTIVE";
    this.touch();
  }

  refund(): void {
    if (this.props.status === "REFUNDED") throw DomainError.invalidTransition("Pack is already refunded");
    this.props.status = "REFUNDED";
    this.touch();
  }

  /**
   * Stops future draw-down when a Growth tenant downgrades/cancels away from
   * GROWTH (§4 WS-D item 3b). Growth-standing-balance-only — never call this
   * for a TOPUP pack, which is tenant property and must keep drawing down
   * after a downgrade. Idempotent (a no-op if already SUSPENDED) and never
   * claws back credits already consumed, mirroring `refund()`. Distinct from
   * REFUNDED: no money moved, this is a plan-eligibility state change.
   */
  suspendForDowngrade(): void {
    if (this.props.source !== "GROWTH_STANDING_BALANCE") {
      throw DomainError.invalidTransition("Only Growth standing-balance packs can be suspended for downgrade");
    }
    if (this.props.status === "SUSPENDED") return;
    if (this.props.status !== "ACTIVE") {
      throw DomainError.invalidTransition(`Cannot suspend a ${this.props.status} pack`);
    }
    this.props.status = "SUSPENDED";
    this.touch();
  }

  /**
   * Restores draw-down when a Growth tenant re-subscribes to GROWTH after a
   * downgrade/cancellation — the exact inverse of `suspendForDowngrade()`.
   * Without this, a re-subscribing tenant's paid standing balance would be
   * stranded in SUSPENDED forever. Remaining credits are preserved (suspension
   * never claws back or consumes anything); an EXHAUSTED or REFUNDED pack is
   * not reactivatable. Idempotent (a no-op if already ACTIVE).
   */
  reactivate(): void {
    if (this.props.source !== "GROWTH_STANDING_BALANCE") {
      throw DomainError.invalidTransition("Only Growth standing-balance packs can be reactivated");
    }
    if (this.props.status === "ACTIVE") return;
    if (this.props.status !== "SUSPENDED") {
      throw DomainError.invalidTransition(`Cannot reactivate a ${this.props.status} pack`);
    }
    this.props.status = "ACTIVE";
    this.touch();
  }
}
