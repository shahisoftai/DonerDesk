import type { DatasetSources } from "../datasets/dataset-sources.js";
import { DomainError, normalizeLocationKey, canvasToWidgets, definitionFor, isDashboardKind, projectOf, type BlockModel, type Canvas, type CanvasFacts, type DataSheet, type FilterChoices, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import { ShareLinkExtras, type IShareMapReader } from "../../services/share-link-extras.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import { drawCharts, type DashboardChartDto } from "../dashboards/dashboard-handlers.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { GetProjectInfographicDataHandler } from "../infographics/infographic-data.js";
import { fail, ok } from "./canvas-shared.js";
import { attachMapCallouts, canvasFactsFor, filterChoices, needsCounts, type CanvasFilterOptions } from "./resolve-canvas.js";
import type { ICountFactsReader, IPlaceTreeReader } from "../../services/count-facts-service.js";

/** What a link holder may narrow the page by: a period and places. Donors, partners and money are never offered through a link. */
export type PublicFilterChoices = Pick<FilterChoices, "periods" | "places" | "placeTree">;
export interface PublicCanvasDto { title: string; canvas: Canvas; drawings: DashboardChartDto[]; models: Record<string, BlockModel<unknown>>; choices: PublicFilterChoices }
const unavailable = (reason: string): BlockModel<unknown> => ({ state: "unavailable", reason });

/**
 * What a LIVE link holder sees: the canvas drawn now from the records, as an outside guest. Finance never goes out, a list of the
 * organisation's projects and the portfolio are not shown, and nothing names a person. Only the projects the canvas itself names are read.
 */
export class PublicCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly info: GetProjectInfographicDataHandler, private readonly extras?: IDatasetExtras, private readonly maps?: IShareMapReader, private readonly counts?: ICountFactsReader & Partial<IPlaceTreeReader>, private readonly datasets?: Pick<DatasetSources, "blockData">) {}

  async handle(tenantId: TenantId, canvasId: string, filters: Pick<CanvasFilterOptions, "periodId" | "placeKeys" | "datasetFilters"> = {}): Promise<Result<PublicCanvasDto, DomainError>> {
    const found = await this.repo.findById(canvasId, tenantId);
    if (!found.ok || !found.value) return fail(DomainError.notFound("Canvas", "unavailable"));
    const stored = found.value;
    const guest: AuthenticatedContext = { tenant: { tenantId, userId: "share-link", role: "VIEWER", external: true } as never, requestId: "share-link" };
    const { widgets, withoutProject } = canvasToWidgets(stored.canvas, stored.projectId);
    let drawings = await drawCharts(widgets, async (projectId) => {
      const sheet = await this.sheets.handle(guest, projectId);
      return sheet.ok ? ({ ...sheet.value, finance: [], registerFinance: undefined, financeEnabled: false } as DataSheet) : null;
    }, this.extras ? { ctx: guest, service: new ShareLinkExtras(this.extras) } : undefined, filters.periodId, this.maps ? { maps: this.maps } : undefined);
    const models: Record<string, BlockModel<unknown>> = {};
    for (const id of withoutProject) models[id] = unavailable("This block has no project.");
    // One reader of a project's facts for everything on the page: its blocks, its map cards and the choices its filters offer. Each project is read once.
    const facts = new Map<string, ReturnType<typeof canvasFactsFor>>();
    const homeId = stored.projectId ?? stored.canvas.pages.flatMap((p) => p.blocks).map((b) => projectOf(b.bindings)).find(Boolean);
    const tree = this.counts?.tree ? await this.counts.tree(guest) : undefined;
    const factsOf = async (id: string | undefined): Promise<CanvasFacts | undefined> => {
      if (!id) return undefined;
      if (!facts.has(id)) facts.set(id, canvasFactsFor(this.sheets, this.info, guest, id, stored.canvas, stored.title, filters, needsCounts(stored.canvas) ? this.counts : undefined, { shareLink: true }));
      const f = await facts.get(id);
      // One place chosen: figure cards are headed by that place's own name, as for a signed-in viewer.
      const named = f && filters.placeKeys?.length === 1 ? tree?.find((p) => p.key === normalizeLocationKey(filters.placeKeys![0]!)) : undefined;
      return f ? { ...f, ...(named ? { placeName: named.label } : {}), finance: { enabled: false, rows: [] }, sheet: { ...f.sheet, finance: [], registerFinance: undefined } } : undefined;
    };
    for (const page of stored.canvas.pages) for (const block of page.blocks) {
      // A repeater is shown on screen only: a link never lists the organisation's projects, so what a repeater holds is not drawn through one.
      if (block.style?.hidden || isDashboardKind(block.kind) || models[block.id] || block.container) continue;
      const def = definitionFor(block.kind) as unknown as { reads?: string; slicer?: boolean; resolve(p: unknown, d: unknown): BlockModel<unknown> } | undefined;
      if (!def) continue;
      if (def.reads === "DATASET") {
        // A link reads a dataset as an outside guest: never a restricted one, never its partner, donor, money or hidden columns (§1.3).
        const props = block.props as { source?: string; column?: string };
        const own = (filters.datasetFilters ?? []).filter((f) => !(def.slicer && f.source === props.source && f.column === props.column));
        const data = props.source && this.datasets ? await this.datasets.blockData(guest, props.source, own, { guest: true }) : undefined;
        models[block.id] = data ? def.resolve(block.props, data) : unavailable("This is not shown through a link.");
        continue;
      }
      if (def.reads !== "FACTS" && def.reads !== undefined) { models[block.id] = unavailable("This block is not shown through a link."); continue; }
      let data: unknown;
      if (def.reads === "FACTS") {
        const pid = projectOf(block.bindings) ?? stored.projectId;
        if (!pid) { models[block.id] = unavailable("This block has no project."); continue; }
        data = await factsOf(pid);
      }
      models[block.id] = def.resolve(block.props, data);
    }
    // Cards on a map, and the choices the page's filters offer: both read as the guest, from what the canvas names.
    drawings = await attachMapCallouts(stored.canvas, stored.projectId, drawings, factsOf, tree);
    const home = await factsOf(homeId);
    const choices: PublicFilterChoices = home ? { ...filterChoices(home), ...(tree ? { placeTree: ownPlaces(tree, filterChoices(home).places) } : {}) } : { periods: [], places: [] };
    return ok({ title: stored.title, canvas: { ...stored.canvas, id: stored.id, title: stored.title }, drawings, models, choices });
  }
}

/**
 * The part of the organisation's places a link may show: the places this project's own records name, and the areas above them (so a
 * province can be chosen before its districts). Other projects' places, in other countries, are never listed through a link.
 */
export function ownPlaces<T extends { key: string; parentKey: string | null }>(tree: readonly T[], used: ReadonlyArray<{ key: string }>): T[] {
  const byKey = new Map(tree.map((p) => [p.key, p] as const));
  const keep = new Set<string>();
  for (const u of used) {
    let cur = byKey.get(u.key);
    for (let i = 0; cur && i < 6 && !keep.has(cur.key); i++) { keep.add(cur.key); cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined; }
  }
  return tree.filter((p) => keep.has(p.key));
}
