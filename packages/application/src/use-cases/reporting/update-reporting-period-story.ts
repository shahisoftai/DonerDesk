import type { Result } from "@donordesk/domain";
import { DomainError, type StoryContext } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface UpdateReportingPeriodStoryInput {
  storyContext: StoryContext;
}

/**
 * Saves the structured "Tell the Story" narrative context for a reporting
 * period. This is the input surface for step ② — the challenges, variance
 * explanations, adaptations and lessons that indicators and evidence alone
 * cannot explain. The AI report writer consumes this as structured context.
 */
export class UpdateReportingPeriodStoryHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, periodId: string, input: UpdateReportingPeriodStoryInput): Promise<Result<void, DomainError>> {
    const r = await this.periods.findById(periodId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    const period = r.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", periodId) };

    // The five story answers are saved on their own: the per-section compliance statements are kept as they are.
    period.setStoryContext({ ...input.storyContext, ...(period.storyContext.sectionNotes ? { sectionNotes: period.storyContext.sectionNotes } : {}) });
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.story_updated",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      newValue: JSON.stringify({ storyContext: input.storyContext }),
    });
    return { ok: true, value: undefined };
  }
}
