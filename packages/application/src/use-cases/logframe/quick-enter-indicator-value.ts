import type { Result } from "@donordesk/domain";
import { DomainError, chooseQuickEntryPeriod, effectiveIndicatorSemantics, latestPreviousValues, quickEntryCumulative, type ReviewDecision } from "@donordesk/domain";
import type { QuickEnterIndicatorValueInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { AutoReviewService } from "../../services/auto-review.js";
import type { CreateIndicatorUpdateHandler } from "./create-indicator-update.js";

export interface QuickEntryOutcome {
  id: string;
  reportingPeriodId: string;
  /** How the period was chosen: by the date, or named by the caller. */
  chosenBy: "DATE" | "PERIOD";
  /** The running total that was saved, and whether it was typed, suggested or left empty. */
  cumulative: string;
  cumulativeSource: "TYPED" | "SUGGESTED" | "NONE";
  outcome: ReviewDecision["outcome"];
  /** Plain sentences for the person: what happened to the value, and anything it still needs. Never blocks the save. */
  notices: string[];
}

/**
 * Enter one indicator value from a date (Phase 36). The reporting period is derived from the date, the running total is
 * suggested for an indicator that adds up, and the save goes through `CreateIndicatorUpdateHandler`, so every rule that
 * protects a value (locked report, entry window, value checks, breakdown checks, calculated indicators) still applies
 * unchanged. Afterwards the project's review setting decides whether the value is handed in at once.
 */
export class QuickEnterIndicatorValueHandler {
  constructor(
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly create: Pick<CreateIndicatorUpdateHandler, "handle">,
    private readonly review: AutoReviewService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: QuickEnterIndicatorValueInput): Promise<Result<QuickEntryOutcome, DomainError>> {
    const indicator = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!indicator.ok) return indicator;
    if (!indicator.value) return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };
    const projectId = indicator.value.projectId;

    const periods = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
    if (!periods.ok) return periods;
    const dated = periods.value.map((p) => ({ id: p.id, startDate: p.duration.start, endDate: p.duration.end }));
    const choice = chooseQuickEntryPeriod({ date: input.date, periods: dated, periodId: input.reportingPeriodId });
    if (!choice.ok) return { ok: false, error: DomainError.validation(choice.message) };
    const period = periods.value.find((p) => p.id === choice.periodId)!;

    // The running total follows the latest earlier period that has a value; it is never invented.
    const earlier = periods.value.filter((p) => p.id !== period.id && p.duration.end.getTime() < period.duration.start.getTime());
    const history = await this.updates.findByIndicator(indicator.value.id, ctx.tenant.tenantId);
    if (!history.ok) return history;
    const previous = latestPreviousValues(
      earlier.map((p) => ({ id: p.id, start: p.duration.start, end: p.duration.end })),
      history.value.map((u) => ({ indicatorId: u.indicatorId, reportingPeriodId: u.reportingPeriodId, periodAchievement: u.periodAchievement, cumulativeAchievement: u.cumulativeAchievement })),
      period.duration.start,
    ).get(indicator.value.id);
    const aggregation = effectiveIndicatorSemantics({ type: indicator.value.type, name: indicator.value.name, unit: indicator.value.unit, semantics: indicator.value.semantics }).aggregation;
    const cumulative = quickEntryCumulative({ aggregation, periodValue: input.periodAchievement, typedCumulative: input.cumulativeAchievement, previousCumulative: previous?.cumulativeAchievement });

    const saved = await this.create.handle(ctx, {
      indicatorId: input.indicatorId,
      reportingPeriodId: choice.periodId,
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: cumulative.value,
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
      ...(input.dataSource !== undefined ? { dataSource: input.dataSource } : {}),
      ...(input.notApplicableReason !== undefined ? { notApplicableReason: input.notApplicableReason } : {}),
      ...(input.disaggregation !== undefined ? { disaggregation: input.disaggregation } : {}),
      attachedEvidenceIds: [],
    });
    if (!saved.ok) return saved;

    const [reviewed] = await this.review.afterSave(ctx, projectId, [saved.value.id]);
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "logframe.indicator.quick_entered",
      entityType: "indicator_update", entityId: saved.value.id, projectId,
      newValue: input.periodAchievement, systemNote: `Entered by date (${choice.chosenBy === "DATE" ? "period found from the date" : "period chosen"}); ${reviewed?.outcome ?? "SAVED_DRAFT"}`,
    });

    const notices: string[] = [];
    if (cumulative.source === "SUGGESTED") notices.push(`The running total was worked out as ${cumulative.value} from the previous period.`);
    if (reviewed?.notice) notices.push(reviewed.notice);
    return {
      ok: true,
      value: {
        id: saved.value.id,
        reportingPeriodId: choice.periodId,
        chosenBy: choice.chosenBy,
        cumulative: cumulative.value,
        cumulativeSource: cumulative.source,
        outcome: reviewed?.outcome ?? "SAVED_DRAFT",
        notices,
      },
    };
  }
}
