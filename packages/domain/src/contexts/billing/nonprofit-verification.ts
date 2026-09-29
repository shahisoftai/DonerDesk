import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type NonprofitVerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface NonprofitVerificationProps {
  tenantId: string;
  registrationNumber: string;
  documentUrl: string;
  status: NonprofitVerificationStatus;
  submittedAt: Date;
  reviewedById?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
}

/**
 * A tenant's submission for the 40% verified nonprofit discount (Phase 22
 * WS-G). Approval does not change domain plan limits — the discount is
 * applied at the Creem checkout/product layer; this record is the audit
 * trail and the gate for which checkout product a tenant is offered.
 */
export class NonprofitVerification extends Entity<string> {
  private constructor(
    id: string,
    private props: NonprofitVerificationProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: { id: string; props: { tenantId: string; registrationNumber: string; documentUrl: string; submittedAt: Date } }): NonprofitVerification {
    if (!input.props.tenantId) throw DomainError.validation("Tenant ID required");
    if (!input.props.registrationNumber.trim()) throw DomainError.validation("Registration number required");
    if (!input.props.documentUrl.trim()) throw DomainError.validation("Supporting document required");
    return new NonprofitVerification(input.id, { ...input.props, status: "PENDING" });
  }

  static rehydrate(input: { id: string; props: NonprofitVerificationProps; createdAt: Date }): NonprofitVerification {
    return new NonprofitVerification(input.id, input.props, input.createdAt);
  }

  get tenantId(): string { return this.props.tenantId; }
  get registrationNumber(): string { return this.props.registrationNumber; }
  get documentUrl(): string { return this.props.documentUrl; }
  get status(): NonprofitVerificationStatus { return this.props.status; }
  get submittedAt(): Date { return this.props.submittedAt; }
  get reviewedById(): string | undefined { return this.props.reviewedById; }
  get reviewedAt(): Date | undefined { return this.props.reviewedAt; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }

  approve(reviewedById: string, now: Date): void {
    if (this.props.status !== "PENDING") throw DomainError.invalidTransition("Only a pending verification can be approved");
    this.props.status = "APPROVED";
    this.props.reviewedById = reviewedById;
    this.props.reviewedAt = now;
    this.touch();
  }

  reject(reviewedById: string, reason: string, now: Date): void {
    if (this.props.status !== "PENDING") throw DomainError.invalidTransition("Only a pending verification can be rejected");
    if (!reason.trim()) throw DomainError.validation("A rejection reason is required");
    this.props.status = "REJECTED";
    this.props.reviewedById = reviewedById;
    this.props.reviewedAt = now;
    this.props.rejectionReason = reason;
    this.touch();
  }
}
