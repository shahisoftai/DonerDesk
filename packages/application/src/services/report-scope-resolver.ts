import type { ReportingPeriod, ReportScope, Result, TenantId } from "@donordesk/domain";
import { DomainError, missingScopeFields, normalizeEventName, normalizeReportScope } from "@donordesk/domain";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IReportingPeriodRepository } from "../ports/reporting.js";

export interface ResolveScopeInput {
  reportType: string;
  /** The scope as submitted (untrusted). */
  scope: unknown;
  projectId: string;
  tenantId: TenantId;
  /**
   * Editing an existing period: its current scope and id. Series numbering is
   * kept while the event is unchanged and recomputed when it moves to another event.
   */
  existing?: { periodId: string; scope: ReportScope };
  /** The project's periods, when the caller already loaded them. */
  projectPeriods?: ReadonlyArray<ReportingPeriod>;
}

/**
 * The one place a report's scope is validated and completed: client input is
 * normalised, the server-owned fields (series number, previous report) are set
 * here and never taken from the client, required fields are enforced and the
 * activities an activity report names must belong to the project.
 */
export class ReportScopeResolver {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: IActivityUpdateRepository,
  ) {}

  async resolve(input: ResolveScopeInput): Promise<Result<ReportScope, DomainError>> {
    const scope = normalizeReportScope(input.scope);
    delete scope.sequence;
    delete scope.previousPeriodId;
    delete scope.previousSituationDate;
    if (input.reportType !== "CUSTOM") delete scope.sections;

    const missing = missingScopeFields(input.reportType, scope);
    if (missing.length > 0) {
      return { ok: false, error: DomainError.validation(`A ${input.reportType.toLowerCase()} report needs its scope (${missing.join(", ")})`) };
    }

    if (input.reportType === "ACTIVITY") {
      const projectActivities = await this.activities.findByProject(input.projectId, input.tenantId);
      if (!projectActivities.ok) return projectActivities;
      const known = new Set(projectActivities.value.map((a) => a.id));
      const unknown = (scope.activityIds ?? []).filter((id) => !known.has(id));
      if (unknown.length > 0) return { ok: false, error: DomainError.notFound("ActivityUpdate", unknown[0]!) };
    }

    if (input.reportType === "SITUATION") {
      const series = await this.situationSeries(input, scope);
      if (!series.ok) return series;
      Object.assign(scope, series.value);
    }
    return { ok: true, value: scope };
  }

  /** Series number and previous report of a situation report, from the others on the same event. */
  private async situationSeries(input: ResolveScopeInput, scope: ReportScope): Promise<Result<Pick<ReportScope, "sequence" | "previousPeriodId" | "previousSituationDate">, DomainError>> {
    const event = normalizeEventName(scope.eventName);
    // Same event as before: the report keeps its place in the series.
    if (input.existing && normalizeEventName(input.existing.scope.eventName) === event) {
      const { sequence, previousPeriodId, previousSituationDate } = input.existing.scope;
      return { ok: true, value: { ...(sequence ? { sequence } : {}), ...(previousPeriodId ? { previousPeriodId } : {}), ...(previousSituationDate ? { previousSituationDate } : {}) } };
    }
    let all = input.projectPeriods;
    if (!all) {
      const loaded = await this.periods.findByProject(input.projectId, input.tenantId);
      if (!loaded.ok) return loaded;
      all = loaded.value;
    }
    const series = all
      .filter((p) => p.id !== input.existing?.periodId && p.reportType === "SITUATION" && normalizeEventName(p.scope.eventName) === event)
      .sort((a, b) => b.duration.end.getTime() - a.duration.end.getTime());
    const previous = series[0];
    return {
      ok: true,
      value: {
        sequence: series.length + 1,
        ...(previous
          ? { previousPeriodId: previous.id, previousSituationDate: previous.scope.situationDate ?? previous.duration.end.toISOString().slice(0, 10) }
          : {}),
      },
    };
  }
}
