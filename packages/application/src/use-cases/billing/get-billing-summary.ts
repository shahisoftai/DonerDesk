import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { EntitlementService } from "../../services/entitlement-service.js";

export interface BillingSummaryDto {
  plan: string;
  source: string;
  catalogVersion: number;
  trialEndsAt?: string;
  isTrial: boolean;
  subscription?: {
    status: string;
    interval?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
  };
  limits: {
    maxActiveProjects: number | null;
    maxSeats: number | null;
    maxManagedStorageBytes: string | null;
    monthlyAiDraftCredits: number | null;
  };
  overLimit: string[];
  usage: {
    projects: { used: number; limit: number | null };
    seats: { used: number; limit: number | null };
    managedStorageBytes: { used: string; limit: string | null };
    aiDraftCredits: { used: number; limit: number | null; resetsAt?: string };
  };
}

/**
 * Read model for the billing settings page. Derived through the entitlement
 * service so the UI and enforcement never drift.
 */
export class GetBillingSummaryHandler {
  constructor(private readonly entitlements: EntitlementService) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<BillingSummaryDto, DomainError>> {
    const summary = await this.entitlements.toSummary({ tenantId: ctx.tenant.tenantId.toString() });
    if (!summary.ok) return summary;
    return { ok: true, value: summary.value };
  }
}
