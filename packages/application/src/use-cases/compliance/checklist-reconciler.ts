import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistReconciler } from "../../ports/compliance.js";

/** What the reconciler needs from the detector: one pass that only closes. */
export interface ChecklistClosingPass {
  handle(ctx: AuthenticatedContext, reportingPeriodId: string, options: { mode: "RECONCILE" }): Promise<Result<{ created: number; closed: number }, DomainError>>;
}

/**
 * Runs the closing pass for a period when its checklist or readiness is read. A short window per period keeps a page
 * that reads both from doing the work twice; errors are swallowed because reading must never fail on housekeeping.
 */
export class ChecklistReconciler implements IChecklistReconciler {
  private readonly lastRun = new Map<string, number>();

  constructor(
    private readonly pass: ChecklistClosingPass,
    private readonly windowMs = 3000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async reconcile(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<void> {
    const key = `${ctx.tenant.tenantId.toString()}:${reportingPeriodId}`;
    const at = this.now();
    const previous = this.lastRun.get(key);
    if (previous !== undefined && at - previous < this.windowMs) return;
    this.lastRun.set(key, at);
    if (this.lastRun.size > 500) this.lastRun.delete(this.lastRun.keys().next().value as string);
    try {
      await this.pass.handle(ctx, reportingPeriodId, { mode: "RECONCILE" });
    } catch {
      // housekeeping only: the checklist is shown as it is
    }
  }
}
