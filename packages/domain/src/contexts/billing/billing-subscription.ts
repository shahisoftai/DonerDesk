import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { PlanCode } from "./plan.js";
import type { EntitlementSource } from "./entitlement.js";

export type BillingProviderCode = "CREEM";

export type BillingInterval = "MONTH" | "YEAR";

export type BillingSubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "UNPAID"
  | "CANCELLED"
  | "EXPIRED"
  | "PAUSED";

export interface BillingSubscriptionProps {
  tenantId: string;
  provider: BillingProviderCode;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerProductId: string;
  planCode: PlanCode;
  catalogVersion: number;
  status: BillingSubscriptionStatus;
  currency: string;
  unitAmountMinor: number;
  billingInterval: BillingInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  graceEndsAt?: Date;
  providerUpdatedAt?: Date;
  lastSyncedAt?: Date;
}

/**
 * Provider synchronization state for one access-granting subscription.
 * Distinct from EntitlementSnapshot (the calculated answer) — see
 * memorybank/Features/19-Tiers-And-Payments.md §4.
 */
export class BillingSubscription extends Entity<string> {
  private constructor(
    id: string,
    private props: BillingSubscriptionProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: { id: string; props: BillingSubscriptionProps }): BillingSubscription {
    BillingSubscription.validate(input.props);
    return new BillingSubscription(input.id, input.props);
  }

  static rehydrate(input: {
    id: string;
    props: BillingSubscriptionProps;
    createdAt: Date;
  }): BillingSubscription {
    BillingSubscription.validate(input.props);
    return new BillingSubscription(input.id, input.props, input.createdAt);
  }

  private static validate(p: BillingSubscriptionProps): void {
    if (!p.tenantId) throw DomainError.validation("Tenant ID required");
    if (!p.providerCustomerId) throw DomainError.validation("Provider customer ID required");
    if (!p.providerSubscriptionId) throw DomainError.validation("Provider subscription ID required");
    if (!p.providerProductId) throw DomainError.validation("Provider product ID required");
    if (!p.currency || p.currency.length !== 3) throw DomainError.validation("Currency must be an ISO-4217 code");
    if (p.unitAmountMinor < 0) throw DomainError.validation("Unit amount must be non-negative");
  }

  get tenantId(): string { return this.props.tenantId; }
  get provider(): BillingProviderCode { return this.props.provider; }
  get providerCustomerId(): string { return this.props.providerCustomerId; }
  get providerSubscriptionId(): string { return this.props.providerSubscriptionId; }
  get providerProductId(): string { return this.props.providerProductId; }
  get planCode(): PlanCode { return this.props.planCode; }
  get catalogVersion(): number { return this.props.catalogVersion; }
  get status(): BillingSubscriptionStatus { return this.props.status; }
  get currency(): string { return this.props.currency; }
  get unitAmountMinor(): number { return this.props.unitAmountMinor; }
  get billingInterval(): BillingInterval { return this.props.billingInterval; }
  get currentPeriodStart(): Date | undefined { return this.props.currentPeriodStart; }
  get currentPeriodEnd(): Date | undefined { return this.props.currentPeriodEnd; }
  get trialStart(): Date | undefined { return this.props.trialStart; }
  get trialEnd(): Date | undefined { return this.props.trialEnd; }
  get cancelAtPeriodEnd(): boolean { return this.props.cancelAtPeriodEnd; }
  get canceledAt(): Date | undefined { return this.props.canceledAt; }
  get graceEndsAt(): Date | undefined { return this.props.graceEndsAt; }
  get providerUpdatedAt(): Date | undefined { return this.props.providerUpdatedAt; }
  get lastSyncedAt(): Date | undefined { return this.props.lastSyncedAt; }

  activate(now: Date): void {
    if (this.props.status === "CANCELLED" || this.props.status === "EXPIRED") {
      throw DomainError.invalidTransition(`Cannot activate a ${this.props.status} subscription`);
    }
    this.props.status = "ACTIVE";
    this.props.graceEndsAt = undefined;
    this.props.lastSyncedAt = now;
    this.touch();
  }

  markPastDue(graceEndsAt: Date): void {
    this.props.status = "PAST_DUE";
    this.props.graceEndsAt = graceEndsAt;
    this.touch();
  }

  markUnpaid(now: Date): void {
    this.props.status = "UNPAID";
    this.props.lastSyncedAt = now;
    this.touch();
  }

  scheduleCancelAtPeriodEnd(now: Date): void {
    this.props.cancelAtPeriodEnd = true;
    this.props.canceledAt = now;
    this.touch();
  }

  cancel(now: Date): void {
    this.props.status = "CANCELLED";
    this.props.cancelAtPeriodEnd = false;
    this.props.canceledAt = now;
    this.props.lastSyncedAt = now;
    this.touch();
  }

  expire(now: Date): void {
    this.props.status = "EXPIRED";
    this.props.cancelAtPeriodEnd = false;
    this.props.lastSyncedAt = now;
    this.touch();
  }

  pause(now: Date): void {
    this.props.status = "PAUSED";
    this.props.lastSyncedAt = now;
    this.touch();
  }

  syncFromProvider(input: {
    status: BillingSubscriptionStatus;
    planCode: PlanCode;
    catalogVersion: number;
    providerProductId: string;
    currency: string;
    unitAmountMinor: number;
    billingInterval: BillingInterval;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialStart?: Date;
    trialEnd?: Date;
    cancelAtPeriodEnd: boolean;
    graceEndsAt?: Date;
    providerUpdatedAt?: Date;
    now: Date;
  }): void {
    this.props.status = input.status;
    this.props.planCode = input.planCode;
    this.props.catalogVersion = input.catalogVersion;
    this.props.providerProductId = input.providerProductId;
    this.props.currency = input.currency;
    this.props.unitAmountMinor = input.unitAmountMinor;
    this.props.billingInterval = input.billingInterval;
    this.props.currentPeriodStart = input.currentPeriodStart;
    this.props.currentPeriodEnd = input.currentPeriodEnd;
    this.props.trialStart = input.trialStart;
    this.props.trialEnd = input.trialEnd;
    this.props.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
    this.props.graceEndsAt = input.graceEndsAt;
    this.props.providerUpdatedAt = input.providerUpdatedAt;
    this.props.lastSyncedAt = input.now;
    this.touch();
  }
}
