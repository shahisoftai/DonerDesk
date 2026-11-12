import { normalizeLocationKey, resolveMultiCard, type CardItem } from "@donordesk/domain";
import type { ICountFactsReader, IPlaceTreeReader } from "../../services/count-facts-service.js";
import { DomainError, EMPTY_CHOICES, childrenOf, repeatKey, groupsOf, restrictSheet, levelsOf, indicatorChoicesOf, statusesOf, type FilterChoices, canvasToWidgets, definitionFor, isDashboardKind, portfolioOnlyFacts, projectOf, type BlockModel, type Canvas, type CanvasFacts, type Result, type Project } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { DashboardChartDto, PreviewDashboardChartsHandler } from "../dashboards/dashboard-handlers.js";
import type { GetProjectInfographicDataHandler } from "../infographics/infographic-data.js";
import type { GetPortfolioInfographicDataHandler } from "../infographics/portfolio-data.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";
import { heldByRepeater, repeatedWidgets, repeaterItems, type RepeatItems } from "./repeat-canvas.js";

/** What a viewer may narrow a canvas by without changing it: a period and/or places. */
export interface CanvasFilterOptions { periodId?: string | undefined; placeKeys?: string[] | undefined; /** Only projects with one of these donors or partners (Phase 50.3). */ donors?: string[] | undefined; partners?: string[] | undefined; group?: string | undefined; status?: string | undefined; level?: string | undefined; indicator?: string | undefined }

export interface ResolvedCanvasDto {
  canvasId: string;
  /** Chart-style blocks (indicator and number tiles, maps, charts, tables), drawn by the dashboards' own code; keyed by `widgetId` = block id. */
  drawings: DashboardChartDto[];
  /** Every other block's model, keyed by block id: the one thing the screen and a file are both painted from. */
  models: Record<string, BlockModel<unknown>>;
  /** What the viewer can narrow the canvas by (the periods and places of its project); empty when it has none. */
  choices: FilterChoices;
  /** What each repeater repeats for, by repeater block id. */
  repeats: Record<string, Array<{ key: string; label: string }>>;
}

const unavailable = (reason: string): BlockModel<unknown> => ({ state: "unavailable", reason });

export class ResolveCanvasHandler {
  constructor(
    private readonly repo: ICanvasRepository, private readonly preview_: PreviewDashboardChartsHandler, private readonly sheets: GetProjectDataSheetHandler,
    private readonly infographicData: GetProjectInfographicDataHandler, private readonly visible: VisibleProjects, private readonly extras?: IDatasetExtras,
    private readonly portfolio?: GetPortfolioInfographicDataHandler, private readonly counts?: ICountFactsReader & Partial<IPlaceTreeReader>,
  ) {}

  /** Reads what a saved canvas shows, for the person looking, under their own access: a project they cannot see yields "unavailable" blocks, never someone else's figures. */
  async handle(ctx: AuthenticatedContext, id: string, options: CanvasFilterOptions = {}): Promise<Result<ResolvedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    return this.resolveDocument(ctx, { id, canvas: found.value.canvas, projectId: found.value.projectId, title: found.value.title }, options);
  }

  /** Reads what an edited, unsaved canvas would show, so an edit is seen before it is saved. Nothing is stored; the reads are the same, under the same access. */
  async preview(ctx: AuthenticatedContext, doc: { canvas: Canvas; projectId: string | undefined; title: string }, options: CanvasFilterOptions = {}): Promise<Result<ResolvedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    return this.resolveDocument(ctx, { id: "preview", ...doc }, options);
  }

  private async resolveDocument(ctx: AuthenticatedContext, stored: { id: string; canvas: Canvas; projectId: string | undefined; title: string }, options: CanvasFilterOptions): Promise<Result<ResolvedCanvasDto, DomainError>> {
    const id = stored.id;
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    // A donor or partner chosen in the filter bar narrows the projects a block may read: a project with neither reads as "not in this selection".
    const byPeople = (wanted: string[] | undefined, of: (p: Project) => Array<string | null | undefined>) => (p: Project) => !wanted?.length || of(p).some((n) => n && wanted.some((w) => w.trim().toLowerCase() === n.trim().toLowerCase()));
    const allowed = new Set(mine.value.filter(byPeople(options.donors, (p) => [p.donorName])).filter(byPeople(options.partners, (p) => [p.partnerOrganization])).map((p) => p.id));
    // Each block reads the project it names, else its canvas's; the facts of a project are read once however many blocks use them.
    const factsByProject = new Map<string, Promise<CanvasFacts | undefined>>();
    const factsOf = (projectId: string | undefined): Promise<CanvasFacts | undefined> => {
      if (!projectId || !allowed.has(projectId)) return Promise.resolve(undefined);
      if (!factsByProject.has(projectId)) factsByProject.set(projectId, canvasFactsFor(this.sheets, this.infographicData, ctx, projectId, stored.canvas, stored.title, options, needsCounts(stored.canvas) ? this.counts : undefined).then(async (f) => {
        // A viewer's one-place filter heads a figure card with the place's own name, from the places list.
        if (!f || options.placeKeys?.length !== 1 || !this.counts?.tree) return f;
        const tree = await this.counts.tree(ctx);
        const hit = tree?.find((p) => p.key === normalizeLocationKey(options.placeKeys![0]!));
        return hit ? { ...f, placeName: hit.label } : f;
      }));
      return factsByProject.get(projectId)!;
    };
    // The filters offer the periods and places of the canvas's project, else of the first project a block reads.
    const homeId = stored.projectId ?? stored.canvas.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean);
    const home = await factsOf(homeId);
    const items = repeaterItems(stored.canvas, mine.value, home ? filterChoices(home).places : []);
    const held = heldByRepeater(stored.canvas, items);

    const base = canvasToWidgets(stored.canvas, stored.projectId);
    const widgets = [...base.widgets.filter((w) => !held.has(w.id)), ...repeatedWidgets(stored.canvas, items)];
    const models: Record<string, BlockModel<unknown>> = {};
    for (const blockId of base.withoutProject.filter((b) => !held.has(b))) models[blockId] = unavailable("Choose the project this block reads.");

    let drawings: DashboardChartDto[] = [];
    if (widgets.length > 0) {
      const drawn = await this.preview_.handle(ctx, widgets, options);
      if (!drawn.ok) return drawn;
      drawings = drawn.value.charts;
    }

    drawings = await attachMapCallouts(stored.canvas, stored.projectId, drawings, factsOf, this.counts?.tree ? await this.counts.tree(ctx) : undefined);
    const list = await this.projectList(ctx);
    const portfolio = await this.portfolioFacts(ctx, stored.canvas);

    for (const page of stored.canvas.pages) for (const block of page.blocks) {
      if (block.style?.hidden || isDashboardKind(block.kind) || models[block.id] || held.has(block.id)) continue;
      const def = definitionFor(block.kind) as unknown as { reads?: "FACTS" | "VIEWER_PROJECTS" | "PORTFOLIO"; resolve(props: unknown, data: unknown): BlockModel<unknown> } | undefined;
      if (!def) { models[block.id] = unavailable("This block is not one the product knows."); continue; }
      let data: unknown;
      if (def.reads === "VIEWER_PROJECTS") data = list;
      else if (def.reads === "PORTFOLIO") data = portfolio ? portfolioOnlyFacts(portfolio) : undefined;
      else if (def.reads === "FACTS") {
        const facts = await factsOf(projectOf(block.bindings) ?? stored.projectId);
        // A figure block may count the portfolio (a "projects" card): the portfolio is added only when its settings ask.
        data = facts && portfolio && JSON.stringify(block.props).includes('"PORTFOLIO_') ? { ...facts, portfolio } : facts;
      }
      models[block.id] = def.resolve(block.props, data);
    }
    await this.resolveRepeated(stored.canvas, items, models, factsOf, home);
    return ok({ canvasId: id, drawings, models, repeats: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.map((x) => ({ key: x.key, label: x.label }))])), choices: home ? { ...filterChoices(home), groups: groupsOf(home.sheet), levels: levelsOf(home.sheet), indicators: indicatorChoicesOf(home.sheet), statuses: await this.statuses(ctx, stored, home), ...(await this.peopleChoices(ctx, mine.value)) } : EMPTY_CHOICES });
  }

  /** Each block a repeater holds, once per item: a project\'s own facts, or the project\'s facts narrowed to one place. Chart-style copies were drawn above. */
  private async resolveRepeated(canvas: Canvas, items: RepeatItems, models: Record<string, BlockModel<unknown>>, factsOf: (id: string | undefined) => Promise<CanvasFacts | undefined>, home: CanvasFacts | undefined): Promise<void> {
    for (const page of canvas.pages) for (const holderId of Object.keys(items)) for (const child of childrenOf(page.blocks, holderId)) {
      if (child.style?.hidden || isDashboardKind(child.kind)) continue;
      const def = definitionFor(child.kind) as unknown as { reads?: string; resolve(p: unknown, d: unknown): BlockModel<unknown> } | undefined;
      for (const item of items[holderId] ?? []) {
        const key = repeatKey(child.id, item.key);
        if (!def || def.reads !== "FACTS") { models[key] = unavailable("This block does not change from one item to the next."); continue; }
        const facts = item.projectId ? await factsOf(item.projectId) : home && item.placeKey ? { ...home, locationKeys: [item.placeKey], placeName: item.label } : undefined;
        models[key] = def.resolve(child.props, facts);
      }
    }
  }

  /** The places tree and the donors and partners of the viewer's projects, for the filter bar. */
  private async peopleChoices(ctx: AuthenticatedContext, projects: ReadonlyArray<{ donorName: string; partnerOrganization?: string | undefined }>): Promise<Pick<FilterChoices, "placeTree" | "donors" | "partners">> {
    const tree = this.counts?.tree ? await this.counts.tree(ctx) : undefined;
    const uniq = (xs: Array<string | undefined>) => [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { ...(tree ? { placeTree: tree } : {}), donors: uniq(projects.map((p) => p.donorName)), partners: uniq(projects.map((p) => p.partnerOrganization)) };
  }

  /** The plain statuses of the home project's planned work, for the filter. */
  private async statuses(ctx: AuthenticatedContext, stored: { projectId: string | undefined; canvas: Canvas }, home: CanvasFacts): Promise<string[]> {
    const pid = stored.projectId ?? stored.canvas.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean);
    void home;
    const rows = pid && this.extras ? await this.extras.plan(ctx, pid) : undefined;
    return rows ? statusesOf(rows) : [];
  }

  /** The portfolio, read once and only when some block on the canvas draws from it. */
  private async portfolioFacts(ctx: AuthenticatedContext, canvas: Canvas) {
    const wanted = canvas.pages.some((p) => p.blocks.some((b) => !b.style?.hidden && (definitionFor(b.kind) as { reads?: string } | undefined)?.reads === "PORTFOLIO" || JSON.stringify(b.props).includes('"PORTFOLIO_')));
    if (!wanted || !this.portfolio) return undefined;
    const read = await this.portfolio.handle(ctx);
    return read.ok ? read.value : undefined;
  }

  private async projectList(ctx: AuthenticatedContext) {
    if (!this.extras) return undefined;
    const projects = await this.extras.visibleProjects(ctx);
    if (!projects) return undefined;
    return { projects, userId: ctx.tenant.userId, bookmarkedIds: [...(await this.extras.bookmarkedProjectIds(ctx))] };
  }
}

/** The figures an infographic-style block reads, taken from the same records the Data Center and the Studio read. */
export async function canvasFactsFor(sheets: GetProjectDataSheetHandler, infographicData: GetProjectInfographicDataHandler, ctx: AuthenticatedContext, projectId: string, canvas: Canvas, title: string, filters: CanvasFilterOptions = {}, counts?: ICountFactsReader, countOptions: { shareLink?: boolean } = {}): Promise<CanvasFacts | undefined> {
  const [sheet, data] = await Promise.all([sheets.handle(ctx, projectId), infographicData.handle(ctx, projectId)]);
  if (!sheet.ok || !data.ok) return undefined;
  const countFacts = counts ? await counts.read(ctx, [projectId], [sheet.value], countOptions) : undefined;
  const o = canvas.options;
  return {
    sheet: restrictSheet(sheet.value, filters), reach: data.value.reach, activities: data.value.activities, finance: data.value.finance, indicators: data.value.indicators, levelWords: data.value.levelWords,
    // A viewer's own filter narrows what the design chose: a period ends the range there, places replace the default places.
    range: { fromId: o?.periodFromId, toId: filters.periodId ?? o?.periodToId }, locationKeys: filters.placeKeys?.length ? filters.placeKeys : o?.locationKeys, acknowledgement: o?.acknowledgement, subtitle: o?.subtitle,
    project: { title: data.value.project.title, donorName: data.value.project.donorName, country: data.value.project.country }, designTitle: title,
    ...(countFacts ? { counts: countFacts } : {}),
  };
}

/** Counts are read only when some block on the canvas shows one (a card's count, or figure cards on a map). */
export const needsCounts = (canvas: Canvas): boolean => canvas.pages.some((p) => p.blocks.some((b) => !b.style?.hidden && JSON.stringify(b.props ?? {}).includes('"kind":"COUNT"')));

const MAX_PLACES = 40;
/** The periods and places a viewer may filter by: what the project's own records name. */
export function filterChoices(f: CanvasFacts): Pick<FilterChoices, "periods" | "places"> {
  const places = new Map<string, string>();
  for (const r of f.reach.registeredByLocation) places.set(r.key, r.location);
  for (const r of f.activities.rows) places.set(r.key, r.location);
  for (const i of f.indicators) if (i.location.kind === "ADDITIVE" || i.location.kind === "RECORDED") for (const r of i.location.rows) places.set(r.key, r.location);
  return { periods: f.sheet.periods.map((p) => ({ id: p.id, label: p.label })), places: [...places.entries()].slice(0, MAX_PLACES).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label)) };
}

/**
 * Cards on a results map (Phase 50.3d): each chosen place's figures, worked out from the project's facts narrowed to that one place by the
 * same rule as a figure card, and a person's own text cards tied to a place. Read under the viewer's own access (or a link's, which never
 * sees more); a project the viewer cannot see gives no cards. Shared by the signed-in canvas and the public link.
 */
export async function attachMapCallouts(canvas: Canvas, homeId: string | undefined, drawings: DashboardChartDto[], factsOf: (id: string | undefined) => Promise<CanvasFacts | undefined>, tree: Array<{ key: string; label: string }> | undefined): Promise<DashboardChartDto[]> {
  const byId = new Map(canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, b] as const));
  const out: DashboardChartDto[] = [];
  for (const d of drawings) {
    const block = byId.get(d.widgetId);
    const callouts = (block?.props as { callouts?: { placeKeys: string[]; items: CardItem[]; columns: number; offsets?: Record<string, { dx: number; dy: number }>; texts?: Array<{ id: string; placeKey: string; text: string }> } } | undefined)?.callouts;
    if (!d.map || !block || !callouts || (callouts.placeKeys.length === 0 && !(callouts.texts?.length))) { out.push(d); continue; }
    const facts = await factsOf(projectOf(block.bindings) ?? homeId);
    if (!facts) { out.push(d); continue; }
    // A card is headed by the place's own name: the places list first, then the names the records use, else the key.
    const names = new Map([...filterChoices(facts).places.map((p) => [p.key, p.label] as const), ...(tree ?? []).map((p) => [p.key, p.label] as const)]);
    const cards: Array<{ key: string; name: string; figures: ReturnType<typeof resolveMultiCard>["items"]; text?: string; placeKey?: string }> = callouts.placeKeys.map((k) => normalizeLocationKey(k)).filter(Boolean).slice(0, 30).map((key) => {
      const name = names.get(key) ?? key;
      const model = resolveMultiCard({ items: callouts.items, layout: "GRID", columns: callouts.columns, includeDraft: false }, { sheet: facts.sheet, counts: facts.counts, place: { key, name } });
      return { key, name, figures: model.items };
    });
    // A text card is the person's own words, tied to a place; it carries no figure.
    for (const t of (callouts.texts ?? []).slice(0, 20)) { const key = normalizeLocationKey(t.placeKey); cards.push({ key: `text:${t.id}`, name: names.get(key) ?? t.placeKey, figures: [], text: t.text, placeKey: key }); }
    out.push({ ...d, map: { ...d.map, callouts: cards, calloutColumns: callouts.columns, ...(callouts.offsets ? { calloutOffsets: callouts.offsets } : {}) } });
  }
  return out;
}
