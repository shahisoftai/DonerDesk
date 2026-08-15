import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { PlanCode } from "./plan.js";
import type { EntitlementSource } from "./entitlement.js";
import type { PlanLimits } from "./plan.js";

export interface EntitlementGrantProps {
  tenantId: string;
  planCode: PlanCode;
  source: EntitlementSource;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  billingSubscriptionId?: string;
  overrideLimitsJson?: string | null;
  reason?: string;
  createdById?: string;
}

/**
 * Append-oriented grant of product access. Grants never destroy plan history:
 * new grants are added, old ones remain for audit/rollback.
 */
export class EntitlementGrant extends Entity<string> {
  private constructor(
    id: string,
    private props: EntitlementGrantProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: { id: string; props: EntitlementGrantProps }): EntitlementGrant {
    EntitlementGrant.validate(input.props);
    return new EntitlementGrant(input.id, input.props);
  }

  static rehydrate(input: {
    id: string;
    props: EntitlementGrantProps;
    createdAt: Date;
  }): EntitlementGrant {
    EntitlementGrant.validate(input.props);
    return new EntitlementGrant(input.id, input.props, input.createdAt);
  }

  private static validate(p: EntitlementGrantProps): void {
    if (!p.tenantId) throw DomainError.validation("Tenant ID required");
    if (!p.planCode) throw DomainError.validation("Plan code required");
    if (!p.source) throw DomainError.validation("Entitlement source required");
    if (!(p.effectiveFrom instanceof Date) || Number.isNaN(p.effectiveFrom.getTime())) {
      throw DomainError.validation("Effective-from date required");
    }
    if (p.effectiveUntil && p.effectiveUntil.getTime() <= p.effectiveFrom.getTime()) {
      throw DomainError.validation("Effective-until must be after effective-from");
    }
    if (p.source === "CREEM_SUBSCRIPTION" && !p.billingSubscriptionId) {
      throw DomainError.validation("Subscription grants require a billing subscription");
    }
  }

  get tenantId(): string { return this.props.tenantId; }
  get planCode(): PlanCode { return this.props.planCode; }
  get source(): EntitlementSource { return this.props.source; }
  get effectiveFrom(): Date { return new Date(this.props.effectiveFrom.getTime()); }
  get effectiveUntil(): Date | undefined {
    return this.props.effectiveUntil ? new Date(this.props.effectiveUntil.getTime()) : undefined;
  }
  get billingSubscriptionId(): string | undefined { return this.props.billingSubscriptionId; }
  get overrideLimitsJson(): string | null | undefined { return this.props.overrideLimitsJson; }
  get reason(): string | undefined { return this.props.reason; }
  get createdById(): string | undefined { return this.props.createdById; }

  isEffectiveAt(now: Date): boolean {
    if (this.props.effectiveFrom.getTime() > now.getTime()) return false;
    if (this.props.effectiveUntil && this.props.effectiveUntil.getTime() <= now.getTime()) return false;
    return true;
  }
}
