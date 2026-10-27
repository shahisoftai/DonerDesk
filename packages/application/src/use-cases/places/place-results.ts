import {
  DomainError, PlaceRegistry, ok, indicatorLocationRows, isRateIndicator, rollupByPlace, type AdminLevel, type PlaceRecord, type PlaceRollup, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlaceRepository } from "../../ports/places.js";

export interface PlaceResultsDto {
  level: AdminLevel;
  /** The levels the organisation's list actually has places at (what the level picker offers). */
  levelsAvailable: AdminLevel[];
  /** True when the organisation has no places yet: the screen points to the Places list. */
  noPlaces: boolean;
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    unit: string | null;
    type: string;
    isRate: boolean;
    rollup: PlaceRollup;
  }>;
  /** Indicators with no LOCATION breakdown anywhere: listed so a gap is visible, never shown as zero. */
  withoutLocation: Array<{ id: string; code: string; name: string }>;
}

/**
 * The Data Center's "By place" view (Phase 33.2): each indicator's recorded per-location values read at a
 * chosen level of the organisation's place tree. Reads only; the domain (`rollupByPlace`) decides what may
 * be added, what is partly reported and what stays unplaced.
 */
export class GetProjectPlaceResultsHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly places: IPlaceRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, level: AdminLevel): Promise<Result<PlaceResultsDto, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const project = await this.projects.findById(projectId, tenantId);
    if (!project.ok) return project;
    if (!project.value || project.value.archivedAt) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const [periodsResult, indicatorsResult, placesResult] = await Promise.all([
      this.periods.findByProject(projectId, tenantId),
      this.indicators.findByProject(projectId, tenantId),
      this.places.list(tenantId),
    ]);
    if (!periodsResult.ok) return periodsResult;
    if (!indicatorsResult.ok) return indicatorsResult;
    if (!placesResult.ok) return placesResult;

    const periods = [...periodsResult.value].sort((a, b) => a.duration.start.getTime() - b.duration.start.getTime());
    const periodOrder = periods.map((p) => p.id);
    const values = await this.updates.findByReportingPeriods(periodOrder, tenantId);
    if (!values.ok) return values;
    const byIndicator = new Map<string, typeof values.value>();
    for (const u of values.value) {
      const list = byIndicator.get(u.indicatorId);
      if (list) list.push(u);
      else byIndicator.set(u.indicatorId, [u]);
    }

    const records: PlaceRecord[] = placesResult.value.map(({ tenantId: _t, createdById: _c, archivedAt: _a, ...r }) => r);
    const registry = new PlaceRegistry(records);
    const levelsAvailable = [...new Set(registry.all().map((p) => p.adminLevel))].sort((a, b) => a - b) as AdminLevel[];
    const countryHint = project.value.country || undefined;

    const out: PlaceResultsDto = { level, levelsAvailable, noPlaces: registry.size === 0, indicators: [], withoutLocation: [] };
    for (const indicator of indicatorsResult.value) {
      const updates = [...(byIndicator.get(indicator.id) ?? [])].sort((a, b) => periodOrder.indexOf(a.reportingPeriodId) - periodOrder.indexOf(b.reportingPeriodId));
      const view = indicatorLocationRows(
        { id: indicator.id, code: indicator.code, name: indicator.name, type: indicator.type },
        updates.map((u) => ({
          reportingPeriodId: u.reportingPeriodId, periodAchievement: u.periodAchievement, cumulativeAchievement: u.cumulativeAchievement,
          verificationStatus: u.verificationStatus, disaggregation: u.disaggregation,
        })),
      );
      const rollup = rollupByPlace(view, registry, level, countryHint ? { country: countryHint } : {});
      if (!rollup) { out.withoutLocation.push({ id: indicator.id, code: indicator.code, name: indicator.name }); continue; }
      out.indicators.push({
        id: indicator.id, code: indicator.code, name: indicator.name, unit: indicator.unit ?? null, type: indicator.type,
        isRate: isRateIndicator({ type: indicator.type, unit: indicator.unit }), rollup,
      });
    }
    return ok(out);
  }
}
