import {
  DomainError, RECORD_PLACE_KINDS, err, extensionFor, insideFootprint, normalizeLocationKey, ok, placesForNewWork, resolvePlace,
  type PlaceTree, type RecordPlaceKind, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IPlaceWordLinkRepository, IProjectAreaRepository, IProjectTypedLocations, IRecordPlaceRepository } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { brief, can, loadTree, visibleProject, type PlaceBrief } from "./place-tree-support.js";

/**
 * A project's own places (Phase 56): its footprint, the places its records point at (with how many of each kind and whether they sit inside
 * the footprint), and its own typed words still to confirm. Only this project; the organisation's list is never shown here.
 */
export interface ProjectAreaView extends PlaceBrief {
  closed: boolean;
  closedReason: string | null;
  /** Records of this project inside the area (any kind). */
  records: number;
}

export interface ProjectSiteView extends PlaceBrief {
  counts: Record<RecordPlaceKind, number>;
  footprint: "INSIDE" | "OUTSIDE" | "NO_FOOTPRINT" | "UNKNOWN";
  /** For an outside place: the area that would bring it in. */
  extension?: { placeId: string; name: string; path: string };
}

export interface ProjectWordView {
  text: string;
  count: number;
  status: "UNRESOLVED" | "AMBIGUOUS";
  candidates: Array<{ id: string; name: string; path: string }>;
}

export interface ProjectPlacesView {
  areas: ProjectAreaView[];
  sites: ProjectSiteView[];
  unconfirmed: ProjectWordView[];
  /** Ids a picker offers first for new work: open areas and everything inside them. */
  forNewWork: string[];
  canEdit: boolean;
}

export interface ProjectPlacesDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  links: IRecordPlaceRepository;
  typed: IProjectTypedLocations;
  words: IPlaceWordLinkRepository;
}

const zeroCounts = (): Record<RecordPlaceKind, number> => Object.fromEntries(RECORD_PLACE_KINDS.map((k) => [k, 0])) as Record<RecordPlaceKind, number>;

export class ListProjectPlacesHandler {
  constructor(private readonly deps: ProjectPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectPlacesView, DomainError>> {
    if (!can(ctx, "project.view")) return err(DomainError.forbidden("You cannot see places"));
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    const tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    const t = tree.value;
    const [areas, typed, words, ...linkSets] = await Promise.all([
      this.deps.areas.list(ctx.tenant.tenantId, projectId),
      this.deps.typed.typedIn(ctx.tenant.tenantId, projectId),
      this.deps.words.list(ctx.tenant.tenantId, projectId),
      ...RECORD_PLACE_KINDS.map((k) => this.deps.links.listByProject(k, ctx.tenant.tenantId, projectId)),
    ]);
    if (!areas.ok) return areas;
    if (!typed.ok) return typed;
    if (!words.ok) return words;
    const counts = new Map<string, Record<RecordPlaceKind, number>>();
    RECORD_PLACE_KINDS.forEach((kind, i) => {
      const set = linkSets[i]!;
      if (!set.ok) return;
      for (const l of set.value) {
        const id = t.current(l.placeId);
        if (!id) continue;
        const c = counts.get(id) ?? zeroCounts();
        c[kind] += 1;
        counts.set(id, c);
      }
    });
    const areaViews: ProjectAreaView[] = areas.value.flatMap((a) => {
      const b = brief(t, a.placeId);
      if (!b) return [];
      const inside = new Set([b.id, ...t.descendants(b.id)]);
      let records = 0;
      for (const [id, c] of counts) if (inside.has(id)) records += Object.values(c).reduce((s, n) => s + n, 0);
      return [{ ...b, closed: a.closedAt !== null, closedReason: a.closedReason, records }];
    }).sort((x, y) => x.path.localeCompare(y.path));
    const sites: ProjectSiteView[] = [...counts].flatMap(([id, c]) => {
      const b = brief(t, id);
      if (!b) return [];
      const verdict = insideFootprint(id, areas.value, t);
      const ext = extensionFor(id, areas.value, t);
      return [{ ...b, counts: c, footprint: verdict.status, ...(ext ? { extension: ext } : {}) }];
    }).sort((x, y) => x.path.localeCompare(y.path));
    return ok({ areas: areaViews, sites, unconfirmed: unconfirmedWords(t, typed.value, new Set(words.value.map((w) => w.word)), areas.value.map((a) => a.placeId)), forNewWork: [...placesForNewWork(areas.value, t)], canEdit: can(ctx, "project.edit") });
  }
}

/** The project's typed words that no place answers to (or that several do), most used first. A confirmed word is never listed again. */
export function unconfirmedWords(tree: PlaceTree, typed: ReadonlyArray<{ text: string }>, confirmed: ReadonlySet<string>, areaIds: readonly string[]): ProjectWordView[] {
  const tally = new Map<string, { text: string; count: number }>();
  for (const t of typed) {
    const key = normalizeLocationKey(t.text);
    if (!key || confirmed.has(key)) continue;
    const at = tally.get(key) ?? { text: t.text.trim(), count: 0 };
    at.count += 1;
    tally.set(key, at);
  }
  const out: ProjectWordView[] = [];
  for (const { text, count } of tally.values()) {
    // Inside the project's own areas first: a word typed on this project most likely means a place it works in.
    let r = resolvePlace(text, tree.registry);
    for (const area of areaIds) {
      if (r.status !== "AMBIGUOUS") break;
      const inside = resolvePlace(text, tree.registry, { withinId: area });
      if (inside.status === "RESOLVED") r = inside;
    }
    if (r.status === "RESOLVED") continue;
    out.push({ text, count, status: r.status, candidates: r.status === "AMBIGUOUS" ? r.candidates.map((p) => ({ id: p.id, name: p.name, path: tree.path(p.id) })) : [] });
  }
  return out.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}
