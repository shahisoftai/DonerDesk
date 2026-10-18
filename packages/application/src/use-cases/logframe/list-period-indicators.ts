import type { Result } from "@donordesk/domain";
import { DEFAULT_ENTRY_DUE_DAYS, DomainError, collectionDue, collectionOwner, toPlainDate, disaggregationMustSum, indicatorParticipantHint, isDueInPeriod, effectiveIndicatorSemantics, latestPreviousValues, type PreviousIndicatorValue } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectRepository } from "../../ports/projects.js";
import { toIndicatorUpdateView, type IndicatorUpdateView } from "./indicator-update-view.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEntryDueDays } from "../../ports/health.js";
import type { IClock } from "../../ports/core.js";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";

export interface PeriodIndicatorRow {
  id: string;
  logframeItemId: string;
  code: string;
  name: string;
  type: string;
  baseline: string;
  target: string;
  unit?: string;
  dataSource?: string;
  frequency?: string;
  disaggregationRequired: boolean;
  /** Each breakdown dimension must add up to the period value (counts and amounts, not rates). */
  breakdownMustSum: boolean;
  /** Percentage/ratio indicators without a configured denominator indicator
   * cannot be independently calculated; their result stays unverifiable. */
  requiresDenominator: boolean;
  logframeLevel: string | null;
  logframeCode: string | null;
  logframeTitle: string | null;
  update: IndicatorUpdateView | null;
  /**
   * False when the indicator's own frequency (quarterly, annual...) says no value is expected in this period and none is
   * recorded: the grid then shows "not due this period" instead of asking for it. Absent frequency means every period.
   */
  dueThisPeriod: boolean;
  /** How a period's value adds up over time (SUM, LATEST, PERCENTAGE...), so the grid can offer a running total. */
  aggregation: string;
  /** This indicator's value from the latest earlier period, to repeat or add to; absent when there is none. */
  previous?: PreviousIndicatorValue;
  /** A non-blocking prompt when linked activities record a different head-count than the indicator reports. */
  participantsHint?: string;
  /** When the value is due and who collects it ("Due by 5 Nov · Amina"); the same rule as the assignment list and the health label. */
  collection?: { dueBy: string; state: import("@donordesk/domain").CollectionState; ownerId?: string };
}

/** Activity/situation reports: the activities the report covers (absent for other types). */
export interface PeriodScopeSummary {
  activityCount: number;
  acceptedActivityCount: number;
}

export class ListPeriodIndicatorsHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly activities?: IActivityUpdateRepository,
    /** Gives the project's start, which a frequency counts from; without it every indicator is due every period. */
    private readonly projects?: IProjectRepository,
    /** Without these two, rows carry no due date (as before). */
    private readonly entryDueDays?: IEntryDueDays,
    private readonly clock?: IClock,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
  ): Promise<Result<{ periodId: string; projectId: string; reportType: string; indicators: PeriodIndicatorRow[]; scope?: PeriodScopeSummary }, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const [itemsResult, indicatorsResult, updatesResult] = await Promise.all([
      this.logframe.findByProject(period.projectId, ctx.tenant.tenantId),
      this.indicators.findByProject(period.projectId, ctx.tenant.tenantId),
      this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId),
    ]);
    if (!itemsResult.ok) return itemsResult;
    if (!indicatorsResult.ok) return indicatorsResult;
    if (!updatesResult.ok) return updatesResult;

    const scopeResult = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;

    // Earlier, non-cancelled periods and what was recorded in them: one query each, however many indicators.
    const allPeriods = await this.periods.findByProject(period.projectId, ctx.tenant.tenantId);
    if (!allPeriods.ok) return allPeriods;
    const earlier = allPeriods.value.filter((p) => p.id !== period.id && p.duration.end.getTime() < period.duration.start.getTime());
    const earlierValues = await this.updates.findByReportingPeriods(earlier.map((p) => p.id), ctx.tenant.tenantId);
    if (!earlierValues.ok) return earlierValues;
    const previousByIndicator = latestPreviousValues(
      earlier.map((p) => ({ id: p.id, start: p.duration.start, end: p.duration.end })),
      earlierValues.value.map((u) => ({ indicatorId: u.indicatorId, reportingPeriodId: u.reportingPeriodId, periodAchievement: u.periodAchievement, cumulativeAchievement: u.cumulativeAchievement, dataSource: u.dataSource })),
      period.duration.start,
    );

    const project = this.projects ? await this.projects.findById(period.projectId, ctx.tenant.tenantId) : undefined;
    if (project && !project.ok) return project;
    const projectStart = project?.value?.duration.start;
    const dueDays = this.entryDueDays ? await this.entryDueDays.forProject(period.projectId, ctx.tenant.tenantId) : DEFAULT_ENTRY_DUE_DAYS;
    const today = this.clock ? toPlainDate(this.clock.now()) : undefined;
    const periodForDue = { id: period.id, start: toPlainDate(period.duration.start)!, end: toPlainDate(period.duration.end)!, isFinal: period.reportType === "FINAL" };

    const itemsById = new Map(itemsResult.value.map((item) => [item.id, item]));
    const updatesByIndicator = new Map(updatesResult.value.map((u) => [u.indicatorId, u]));

    // Accepted activity records of this period, by the indicator they feed (people may attend several, so this is only a hint).
    const periodActivities = this.activities ? await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId) : null;
    if (periodActivities && !periodActivities.ok) return periodActivities;
    const totalsByIndicator = new Map<string, Array<number | undefined>>();
    for (const a of periodActivities?.value ?? []) {
      if (a.status !== "ACCEPTED" || !a.indicatorId) continue;
      totalsByIndicator.set(a.indicatorId, [...(totalsByIndicator.get(a.indicatorId) ?? []), a.participantsTotal]);
    }

    const rows: PeriodIndicatorRow[] = indicatorsResult.value.filter((ind) => inIndicatorScope(scope, ind.id)).map((ind) => {
      const item = ind.logframeItemId ? itemsById.get(ind.logframeItemId) : undefined;
      const update = updatesByIndicator.get(ind.id);
      const requiresDenominator =
        (ind.type === "PERCENTAGE" || ind.type === "RATIO") &&
        !Boolean(ind.semantics?.denominatorIndicatorId) &&
        // A configured directly-reported rate (not calculated from counts) needs no denominator.
        !(ind.semantics?.status === "CONFIGURED" && ind.semantics.aggregation !== "PERCENTAGE" && ind.semantics.aggregation !== "RATIO");
      const hint = indicatorParticipantHint({
        indicator: { name: ind.name, unit: ind.unit, type: ind.type },
        reportedValue: update?.periodAchievement,
        activityTotals: totalsByIndicator.get(ind.id) ?? [],
      });
      return {
        id: ind.id,
        logframeItemId: ind.logframeItemId,
        code: ind.code,
        name: ind.name,
        type: ind.type,
        baseline: ind.baseline,
        target: ind.target,
        unit: ind.unit,
        dataSource: ind.dataSource,
        frequency: ind.frequency,
        disaggregationRequired: ind.disaggregationRequired,
        breakdownMustSum: disaggregationMustSum(ind.type),
        requiresDenominator,
        logframeLevel: item?.level ?? null,
        logframeCode: item?.code ?? null,
        logframeTitle: item?.title ?? null,
        update: update ? toIndicatorUpdateView(update) : null,
        // A recorded value is always expected; otherwise the indicator's own frequency decides.
        dueThisPeriod:
          Boolean(update) ||
          !projectStart ||
          isDueInPeriod(ind.frequency, { projectStart, periodEnd: period.duration.end }, { isFinalPeriod: period.reportType === "FINAL" }),
        aggregation: effectiveIndicatorSemantics({ type: ind.type, name: ind.name, unit: ind.unit, semantics: ind.semantics }).aggregation,
        ...(previousByIndicator.has(ind.id) ? { previous: previousByIndicator.get(ind.id)! } : {}),
        ...(hint ? { participantsHint: hint.message } : {}),
        ...(projectStart && today
          ? (() => {
              const due = collectionDue({ indicator: { id: ind.id, code: ind.code, name: ind.name, frequency: ind.frequency, responsibleUserId: ind.responsibleUserId }, period: periodForDue, projectStart: toPlainDate(projectStart)!, hasValue: Boolean(update && update.periodAchievement.trim() !== ""), today, dueDays });
              const owner = collectionOwner(ind, { meOfficerId: project?.value?.meOfficerId, projectManagerId: project?.value?.projectManagerId });
              return { collection: { dueBy: due.dueBy, state: due.state, ...(owner ? { ownerId: owner } : {}) } };
            })()
          : {}),
      };
    });

    return {
      ok: true,
      value: {
        periodId: period.id,
        projectId: period.projectId,
        reportType: period.reportType,
        indicators: rows,
        ...(scope.activities
          ? { scope: { activityCount: scope.activities.length, acceptedActivityCount: scope.activities.filter((a) => a.status === "ACCEPTED").length } }
          : {}),
      },
    };
  }
}
