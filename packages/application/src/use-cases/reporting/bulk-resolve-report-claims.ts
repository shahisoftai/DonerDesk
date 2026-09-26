import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import { ResolveReportClaimHandler } from "./resolve-report-claim.js";

export interface BulkResolveReportClaimInput {
  claimIds: string[];
  resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";
  notes?: string;
}

/**
 * Applies one resolution decision + one shared note to several report claims
 * in a single action, mirroring BulkResolveChecklistHandler's pattern so a
 * report with 40 failed claims doesn't require 40 individual clicks.
 * Delegates each item to ResolveReportClaimHandler so permission checks,
 * confidentiality gating, and per-section revision reconciliation stay in
 * one place — this handler never duplicates that logic.
 */
export class BulkResolveReportClaimHandler {
  constructor(private readonly resolveClaim: ResolveReportClaimHandler) {}

  async handle(ctx: AuthenticatedContext, input: BulkResolveReportClaimInput): Promise<Result<{ resolved: number; skipped: number }, DomainError>> {
    let resolved = 0;
    let skipped = 0;

    for (const claimId of input.claimIds) {
      const r = await this.resolveClaim.handle(ctx, claimId, {
        resolution: input.resolution,
        notes: input.notes,
      });
      if (!r.ok) {
        if (r.error.code === "NOT_FOUND") {
          skipped++;
          continue;
        }
        return r;
      }
      resolved++;
    }

    return { ok: true, value: { resolved, skipped } };
  }
}
