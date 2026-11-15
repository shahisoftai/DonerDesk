/**
 * The organisation's place tree, read through merges (Phase 56). Every "where" in DonorDesk points at one place of one tree; a place that was
 * merged into another keeps its row (retired, `mergedIntoId` set) so a stored id never dangles. These are the lookups every reader shares.
 * Pure; no node: imports (the web imports the places index).
 */
import { PlaceRegistry, type PlaceRecord } from "./place.js";

const MERGE_HOPS_MAX = 10;

/** The live place an id stands for today: the id itself, or the place it was merged into (followed through chains). Undefined when unknown. */
export function followMerge(id: string, all: ReadonlyMap<string, Pick<PlaceRecord, "id" | "mergedIntoId">>): string | undefined {
  let at = all.get(id);
  for (let hop = 0; at && at.mergedIntoId && hop < MERGE_HOPS_MAX; hop += 1) at = all.get(at.mergedIntoId);
  return at?.id;
}

/** The tree with merges applied: lookups by id answer for merged ids too. Built once per request from the whole list (retired rows included). */
export class PlaceTree {
  readonly registry: PlaceRegistry;
  private readonly all: Map<string, PlaceRecord>;

  constructor(places: readonly PlaceRecord[]) {
    this.all = new Map(places.map((p) => [p.id, p]));
    this.registry = new PlaceRegistry(places);
  }

  /** The current id for a stored id (merges followed); undefined when the place never existed. */
  current(id: string): string | undefined {
    return followMerge(id, this.all);
  }
  /** The place for a stored id, live or retired, after merges. */
  get(id: string): PlaceRecord | undefined {
    const now = this.current(id);
    return now ? this.all.get(now) : undefined;
  }
  isLive(id: string): boolean {
    const p = this.get(id);
    return !!p && !p.archived;
  }
  /** "Village 1 › Town T › District A1 › Province A": the path read in context (live places only; a retired place reads as its name). */
  path(id: string): string {
    const now = this.current(id);
    if (!now) return "";
    return this.registry.get(now) ? this.registry.pathLabel(now) : (this.all.get(now)?.name ?? "");
  }
  /** The place and every place above it, nearest first. */
  chain(id: string): PlaceRecord[] {
    const now = this.current(id);
    return now ? this.registry.chain(now) : [];
  }
  /** True when `id` is `areaId` or lies anywhere below it. */
  isInside(id: string, areaId: string): boolean {
    const area = this.current(areaId);
    return !!area && this.chain(id).some((p) => p.id === area);
  }
  /** Every live place below the area (any depth), not the area itself. */
  descendants(areaId: string): Set<string> {
    const now = this.current(areaId);
    return now ? this.registry.descendantIds(now) : new Set();
  }
  children(id: string): PlaceRecord[] {
    const now = this.current(id);
    return now ? this.registry.childrenOf(now) : [];
  }
  /** The deepest place both ids sit inside (themselves included); undefined when they share no ancestor. */
  commonArea(a: string, b: string): PlaceRecord | undefined {
    const above = new Set(this.chain(b).map((p) => p.id));
    return this.chain(a).find((p) => above.has(p.id));
  }
  live(): PlaceRecord[] {
    return this.registry.all();
  }
}
