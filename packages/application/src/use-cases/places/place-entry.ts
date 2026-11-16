import {
  DomainError, chooseQuickEntryPeriod, effectiveIndicatorSemantics, err, isDueInPeriod, isPeriodLocked, latestPreviousValues, ok, periodSheetLabel,
  parsePlaceSheetTabs, placeAgenda, placeCellValue, placeSettingOf, placeSheet, quickEntryCumulative, setPlaceCells,
  type AgendaIndicator, type AgendaPlanItem, type AgendaValue, type EntryRow, type Indicator, type PlaceAgenda, type PlaceCellSplit, type PlaceSheet,
  type PlaceTree, type ReportingPeriod, type Result,
} from "@donordesk/domain";
import type { BulkUpsertIndicatorUpdatesInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectAreaRepository, IRecordPlaceRepository } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { BulkUpsertOutcome } from "../logframe/bulk-upsert-indicator-updates.js";
import { agendaPlaces } from "@donordesk/domain";
import { loadTree, visibleProject } from "./place-tree-support.js";

/**
 * Place-first entry and the by-place sheet (Phase 57). Reads build the agenda or sheet from the domain's pure rules; the one write,
 * `SetPlaceCellsHandler`, merges typed cells into each value's stored breakdown (`setPlaceCells`) and saves through the ordinary bulk
 * save with the version it read, so entry windows, locks, verified values, breakdown checks, audit and simple review all still apply.
 * Two people at two places never overwrite each other: a version conflict is read again and merged again.
 */
export interface PlaceEntryDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  links: IRecordPlaceRepository;
  plan: IPlannedActivityRepository;
  indicators: IIndicatorRepository;
  updates: IIndicatorUpdateRepository;
  periods: IReportingPeriodRepository;
  bulk: { handle(ctx: AuthenticatedContext, input: BulkUpsertIndicatorUpdatesInput): Promise<Result<BulkUpsertOutcome, DomainError>> };
}

export interface PeriodChoice { id: string; label: string; start: string; end: string; locked: boolean }

const day = (d: Date) => d.toISOString().slice(0, 10);

function periodChoice(p: ReportingPeriod): PeriodChoice {
  const start = day(p.duration.start);
  const end = day(p.duration.end);
  return { id: p.id, label: periodSheetLabel(start, end), start, end, locked: isPeriodLocked(p.status.value) };
}

interface Loaded { projectId: string; tree: PlaceTree; period: ReportingPeriod; periods: ReportingPeriod[]; indicators: Indicator[]; agendaIndicators: AgendaIndicator[]; values: AgendaValue[]; areas: Awaited<ReturnType<IProjectAreaRepository["list"]>> extends Result<infer T> ? T : never }

/** Everything an agenda or a sheet needs for one project and period, read once. The period is named, or found from a date. */
async function load(deps: PlaceEntryDeps, ctx: AuthenticatedContext, projectId: string, when: { periodId?: string | undefined; date?: string | undefined }): Promise<Result<Loaded, DomainError>> {
  const project = await visibleProject(deps.projects, deps.visible, ctx, projectId);
  if (!project.ok) return project;
  const t = ctx.tenant.tenantId;
  const [tree, areas, periods, indicators] = await Promise.all([loadTree(deps.places, ctx), deps.areas.list(t, projectId), deps.periods.findByProject(projectId, t), deps.indicators.findByProject(projectId, t)]);
  if (!tree.ok) return tree;
  if (!areas.ok) return areas;
  if (!periods.ok) return periods;
  if (!indicators.ok) return indicators;
  const live = periods.value.filter((p) => !p.isCancelled);
  const choice = chooseQuickEntryPeriod({ date: when.date ?? day(new Date()), periods: live.map((p) => ({ id: p.id, startDate: p.duration.start, endDate: p.duration.end })), periodId: when.periodId });
  if (!choice.ok) return err(DomainError.validation(choice.message, { code: choice.code }));
  const period = live.find((p) => p.id === choice.periodId)!;
  const stored = await deps.updates.findByReportingPeriod(period.id, t);
  if (!stored.ok) return stored;
  const projectStart = project.value.duration.start;
  const live_ = indicators.value.filter((i) => !i.archivedAt);
  const agendaIndicators: AgendaIndicator[] = live_.map((i) => ({
    id: i.id, code: i.code, name: i.name, type: i.type, unit: i.unit ?? null,
    setting: placeSettingOf({ placeScope: i.placeScope, recordByPlace: i.recordByPlace, placeLevel: i.placeLevel, placeIds: i.placeIds }),
    calculated: !!i.formula,
    due: !projectStart || isDueInPeriod(i.frequency, { projectStart, periodEnd: period.duration.end }, { isFinalPeriod: period.reportType === "FINAL" }) || stored.value.some((u) => u.indicatorId === i.id),
  }));
  const values: AgendaValue[] = stored.value.map((u) => ({ indicatorId: u.indicatorId, status: u.verificationStatus, notApplicable: u.isNotApplicable, breakdown: u.breakdown }));
  return ok({ projectId, tree: tree.value, period, periods: live, indicators: live_, agendaIndicators, values, areas: areas.value });
}

export interface PlaceAgendaView extends PlaceAgenda {
  place: EntryRow;
  period: PeriodChoice;
  periods: PeriodChoice[];
}

export class GetPlaceAgendaHandler {
  constructor(private readonly deps: PlaceEntryDeps) {}

  async handle(ctx: AuthenticatedContext, input: { projectId: string; placeId: string; periodId?: string | undefined; date?: string | undefined }): Promise<Result<PlaceAgendaView, DomainError>> {
    const loaded = await load(this.deps, ctx, input.projectId, input);
    if (!loaded.ok) return loaded;
    const { tree, period } = loaded.value;
    const placeId = tree.current(input.placeId);
    if (!placeId || !tree.get(placeId)) return err(DomainError.notFound("Place", input.placeId));
    const t = ctx.tenant.tenantId;
    const [items, links] = await Promise.all([this.deps.plan.findByProject(input.projectId, t), this.deps.links.listByProject("PLANNED_ACTIVITY", t, input.projectId)]);
    if (!items.ok) return items;
    if (!links.ok) return links;
    const placesOf = new Map<string, string[]>();
    for (const l of links.value) placesOf.set(l.recordId, [...(placesOf.get(l.recordId) ?? []), l.placeId]);
    const plan: AgendaPlanItem[] = items.value.map((p) => ({ id: p.id, title: p.title, status: p.status, plannedStart: p.plannedStart, plannedEnd: p.plannedEnd, placeIds: placesOf.get(p.id) ?? [] }));
    const choice = periodChoice(period);
    const agenda = placeAgenda({ placeId, period: { start: choice.start, end: choice.end }, periodLocked: choice.locked, indicators: loaded.value.agendaIndicators, values: loaded.value.values, plan, areas: loaded.value.areas, tree });
    return ok({ ...agenda, place: { placeId, name: tree.get(placeId)!.name, path: tree.path(placeId) }, period: choice, periods: loaded.value.periods.map(periodChoice).sort((a, b) => a.start.localeCompare(b.start)) });
  }
}

/** The places a person can start place-first entry from: the project's open areas and the places inside them. */
export class ListAgendaPlacesHandler {
  constructor(private readonly deps: PlaceEntryDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<EntryRow[], DomainError>> {
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    const t = ctx.tenant.tenantId;
    const [tree, areas, links] = await Promise.all([loadTree(this.deps.places, ctx), this.deps.areas.list(t, projectId), this.deps.links.listByProject("PLANNED_ACTIVITY", t, projectId)]);
    if (!tree.ok) return tree;
    if (!areas.ok) return areas;
    if (!links.ok) return links;
    return ok(agendaPlaces(areas.value, tree.value, links.value.map((l) => l.placeId)));
  }
}

export interface PlaceSheetView extends PlaceSheet {
  period: PeriodChoice;
  periods: PeriodChoice[];
}

export class GetPlaceSheetHandler {
  constructor(private readonly deps: PlaceEntryDeps) {}

  async handle(ctx: AuthenticatedContext, input: { projectId: string; periodId?: string | undefined; date?: string | undefined }): Promise<Result<PlaceSheetView, DomainError>> {
    const loaded = await load(this.deps, ctx, input.projectId, input);
    if (!loaded.ok) return loaded;
    const choice = periodChoice(loaded.value.period);
    const sheet = placeSheet({ periodLocked: choice.locked, indicators: loaded.value.agendaIndicators, values: loaded.value.values, areas: loaded.value.areas, tree: loaded.value.tree });
    return ok({ ...sheet, period: choice, periods: loaded.value.periods.map(periodChoice).sort((a, b) => a.start.localeCompare(b.start)) });
  }
}

export interface PlaceCellInput {
  indicatorId: string;
  placeId: string;
  value: string;
  splits?: readonly PlaceCellSplit[] | undefined;
  /** The figure the person saw; when someone else has since changed this cell the save is refused for it. Omitted = no check. */
  expected?: string | undefined;
}

export interface PlaceCellsOutcome {
  periodId: string;
  saved: number;
  notices: string[];
}

const ATTEMPTS = 3;

export class SetPlaceCellsHandler {
  constructor(private readonly deps: PlaceEntryDeps) {}

  async handle(ctx: AuthenticatedContext, input: { projectId: string; periodId?: string | undefined; date?: string | undefined; cells: readonly PlaceCellInput[]; handIn?: boolean | undefined }): Promise<Result<PlaceCellsOutcome, DomainError>> {
    if (input.cells.length === 0) return err(DomainError.validation("Nothing to save"));
    let last: DomainError | null = null;
    // A version conflict means someone saved another place of the same value meanwhile: read again and merge again.
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const result = await this.once(ctx, input);
      if (result.ok || result.error.code !== "CONFLICT" || !(result.error.details as { retry?: boolean } | undefined)?.retry) return result;
      last = result.error;
    }
    return err(last ?? DomainError.conflict("Someone else is saving the same figures. Try again in a moment."));
  }

  private async once(ctx: AuthenticatedContext, input: { projectId: string; periodId?: string | undefined; date?: string | undefined; cells: readonly PlaceCellInput[]; handIn?: boolean | undefined }): Promise<Result<PlaceCellsOutcome, DomainError>> {
    const loaded = await load(this.deps, ctx, input.projectId, input);
    if (!loaded.ok) return loaded;
    const { tree, period, indicators } = loaded.value;
    const t = ctx.tenant.tenantId;
    // An outside partner enters figures only for places inside the project's areas (Phase 56 rule).
    if (ctx.tenant.external) {
      const inside = new Set(agendaPlaces(loaded.value.areas, tree).map((r) => r.placeId));
      if (input.cells.some((c) => !inside.has(tree.current(c.placeId) ?? c.placeId))) return err(DomainError.validation("Choose places inside this project's areas"));
    }
    const stored = await this.deps.updates.findByReportingPeriod(period.id, t);
    if (!stored.ok) return stored;
    const storedOf = new Map(stored.value.map((u) => [u.indicatorId, u]));
    const byIndicator = new Map<string, PlaceCellInput[]>();
    for (const c of input.cells) byIndicator.set(c.indicatorId, [...(byIndicator.get(c.indicatorId) ?? []), c]);

    const earlier = loaded.value.periods.filter((p) => p.duration.end.getTime() < period.duration.start.getTime());
    const rows: BulkUpsertIndicatorUpdatesInput["updates"] = [];
    const notices: string[] = [];
    const changedByOthers: string[] = [];
    for (const [indicatorId, cells] of byIndicator) {
      const indicator = indicators.find((i) => i.id === indicatorId);
      if (!indicator) return err(DomainError.notFound("Indicator", indicatorId));
      if (indicator.formula) return err(DomainError.validation(`${indicator.code} is calculated from other indicators; it is not typed by place.`));
      const current = storedOf.get(indicatorId);
      if (current?.verificationStatus === "VERIFIED") return err(DomainError.conflict(`${indicator.code} is already verified for this period, so nothing was changed. Ask a reviewer to reopen it first.`));
      const breakdown = current?.breakdown ?? [];
      const resolved = [];
      for (const c of cells) {
        const placeId = tree.current(c.placeId);
        if (!placeId || !tree.get(placeId)) return err(DomainError.notFound("Place", c.placeId));
        if (c.expected !== undefined && placeCellValue(breakdown, placeId) !== c.expected.trim()) changedByOthers.push(`${indicator.code} at ${tree.get(placeId)!.name}`);
        resolved.push({ placeId, placeName: tree.get(placeId)!.name, value: c.value, splits: c.splits });
      }
      const merged = setPlaceCells({ indicatorType: indicator.type, stored: breakdown, cells: resolved });
      notices.push(...merged.notices.map((n) => `${indicator.code}: ${n}`));
      const total = merged.total ?? current?.periodAchievement ?? "";
      const cumulative = await this.cumulativeFor(ctx, indicator, earlier, period, total);
      rows.push({
        indicatorId, periodAchievement: total, cumulativeAchievement: cumulative, disaggregation: merged.entries,
        ...(current ? { expectedUpdatedAt: current.updatedAt.toISOString() } : {}),
      });
    }
    if (changedByOthers.length) {
      return err(DomainError.conflict(`Someone else has changed ${changedByOthers.join(", ")} since you opened it. Nothing was saved. Reload to see their figures.`));
    }
    const saved = await this.deps.bulk.handle(ctx, { reportingPeriodId: period.id, updates: rows, ...(input.handIn ? { handIn: true } : {}) });
    if (!saved.ok) {
      // The bulk save's own version check: another place was saved meanwhile. Safe to merge again.
      if (saved.error.code === "CONFLICT" && saved.error.message.startsWith("Someone else has changed")) return err(DomainError.conflict(saved.error.message, { retry: true }));
      return saved;
    }
    return ok({ periodId: period.id, saved: saved.value.saved, notices: [...notices, ...saved.value.notices] });
  }

  /** The running total: for an indicator that adds up, the previous period's total plus this one; otherwise what is stored (never invented). */
  private async cumulativeFor(ctx: AuthenticatedContext, indicator: Indicator, earlier: readonly ReportingPeriod[], period: ReportingPeriod, total: string): Promise<string> {
    const history = await this.deps.updates.findByIndicator(indicator.id, ctx.tenant.tenantId);
    if (!history.ok) return "";
    const previous = latestPreviousValues(
      earlier.map((p) => ({ id: p.id, start: p.duration.start, end: p.duration.end })),
      history.value.map((u) => ({ indicatorId: u.indicatorId, reportingPeriodId: u.reportingPeriodId, periodAchievement: u.periodAchievement, cumulativeAchievement: u.cumulativeAchievement })),
      period.duration.start,
    ).get(indicator.id);
    const aggregation = effectiveIndicatorSemantics({ type: indicator.type, name: indicator.name, unit: indicator.unit, semantics: indicator.semantics }).aggregation;
    const stored = history.value.find((u) => u.reportingPeriodId === period.id)?.cumulativeAchievement;
    return quickEntryCumulative({ aggregation, periodValue: total, typedCumulative: aggregation === "SUM" ? undefined : stored, previousCumulative: previous?.cumulativeAchievement }).value;
  }
}

export interface PlaceSheetImportOutcome {
  /** The cells the file would change (all of them, when applied). */
  changes: number;
  unchanged: number;
  problems: string[];
  applied: boolean;
  notices: string[];
}

/**
 * An uploaded by-place workbook (Phase 57): read against the current sheet, every cell checked, and applied through
 * `SetPlaceCellsHandler` only when nothing is wrong (any bad cell blocks the whole file). `apply: false` only checks.
 */
export class ImportPlaceSheetHandler {
  constructor(private readonly sheets: GetPlaceSheetHandler, private readonly cells: SetPlaceCellsHandler) {}

  async handle(ctx: AuthenticatedContext, input: { projectId: string; periodId: string; tabs: ReadonlyArray<{ name: string; rows: string[][] }>; apply: boolean }): Promise<Result<PlaceSheetImportOutcome, DomainError>> {
    const sheet = await this.sheets.handle(ctx, { projectId: input.projectId, periodId: input.periodId });
    if (!sheet.ok) return sheet;
    const read = parsePlaceSheetTabs(sheet.value, input.tabs);
    const base = { changes: read.edits.length, unchanged: read.unchanged, problems: read.problems, applied: false, notices: [] as string[] };
    if (!input.apply || read.problems.length || read.edits.length === 0) return ok(base);
    const saved = await this.cells.handle(ctx, { projectId: input.projectId, periodId: input.periodId, cells: read.edits.map((e) => ({ indicatorId: e.indicatorId, placeId: e.placeId, value: e.value })) });
    if (!saved.ok) return saved;
    return ok({ ...base, applied: true, notices: saved.value.notices });
  }
}
