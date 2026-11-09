import {
  DomainError, Permissions, isGuestSafe, reduceByKey, resolveFieldRef, shapeTable, sharedJoins, sourceOf, sourcesOf, validateVisualQuery,
  type JoinedInput, type Result, type Role, type VisualQuery, type VisualTable, type DataSheet, type JoinKey,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDataVersions } from "../../ports/visual-data.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { ReadScope, SourceReader } from "./source-readers.js";

/**
 * Asks the catalogue (Phase 48.17). One question about one project: validated by the domain, checked against the asker's
 * permission for every source it touches and against the projects they can see, read through the source readers and shaped by the
 * domain. A question that cannot be answered says why in a sentence ("unavailable"); it is never an empty table or a table of zeros.
 */
export type VisualAnswer =
  | { state: "ready"; table: VisualTable; asOf: string; sources: string[]; versions: Record<string, number>; epoch: string }
  | { state: "unavailable"; reason: string };

export interface VisualQueryOptions {
  /** An outside guest on a share link: only the sources open to guests (validated again here, so a link can never widen access). */
  guest?: boolean;
}

const unavailable = (reason: string): VisualAnswer => ({ state: "unavailable", reason });

export class VisualDataService {
  private readonly readers: ReadonlyMap<string, SourceReader>;

  constructor(
    readers: ReadonlyArray<SourceReader>,
    private readonly sheets: Pick<GetProjectDataSheetHandler, "handle">,
    private readonly visible: Pick<VisibleProjects, "for">,
    private readonly versions: IDataVersions,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.readers = new Map(readers.map((r) => [r.source, r]));
  }

  async query(ctx: AuthenticatedContext, projectId: string, query: VisualQuery, options: VisualQueryOptions = {}): Promise<Result<VisualAnswer, DomainError>> {
    const problems = validateVisualQuery(query);
    if (problems.length > 0) return { ok: false, error: DomainError.validation(problems[0]!.message) };
    const sources = sourcesOf(query);
    if (options.guest && !isGuestSafe(query)) return { ok: true, value: unavailable("This is not shown through a share link.") };
    for (const id of sources) {
      const def = sourceOf(id)!;
      if (!options.guest && !Permissions.can(ctx.tenant.role as Role, def.permission)) return { ok: true, value: unavailable(`You do not have access to ${def.label.toLowerCase()}.`) };
    }
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === projectId)) return { ok: true, value: unavailable("This is from a project you cannot see.") };

    const own = this.readers.get(query.source);
    if (!own) return { ok: true, value: unavailable(`${sourceOf(query.source)!.label} is being connected and cannot be drawn yet.`) };
    const gap = this.unsupported(query);
    if (gap) return { ok: true, value: unavailable(gap) };

    let sheetPromise: Promise<DataSheet | undefined> | undefined;
    const scopeFor = (q: VisualQuery): ReadScope => ({
      ctx, projectId, query: q,
      sheet: () => (sheetPromise ??= this.sheets.handle(ctx, projectId).then((r) => (r.ok ? r.value : undefined))),
    });

    const rows = await own.read(scopeFor(query));
    if (!rows) return { ok: true, value: unavailable("The data for this could not be read just now.") };

    const joined: JoinedInput[] = [];
    for (const other of sources.filter((s) => s !== query.source)) {
      const via = this.joinKeys(query.source, other);
      const reader = this.readers.get(other);
      if (!via || !reader) return { ok: true, value: unavailable(`${sourceOf(other)!.label} cannot be combined with ${sourceOf(query.source)!.label} yet.`) };
      const otherRows = await reader.read(scopeFor({ ...query, source: other }));
      if (!otherRows) return { ok: true, value: unavailable("The data for this could not be read just now.") };
      joined.push({ source: other, keyField: via.joined, mainKeyField: via.main, rows: reduceByKey(other, via.joined, otherRows) });
    }

    const table = shapeTable(rows, query, joined);
    const state = await this.versions.read(ctx.tenant.tenantId.toString(), projectId);
    return { ok: true, value: { state: "ready", table, asOf: this.now().toISOString(), sources, versions: Object.fromEntries(sources.map((s) => [s, state.versions[s] ?? 0])), epoch: state.epoch } };
  }

  /** A field a reader does not fill yet is a sentence, not a blank column. */
  private unsupported(q: VisualQuery): string | undefined {
    const refs = [...q.measures, ...q.groupBy, ...(q.filters ?? []).map((f) => f.field)];
    for (const ref of refs) {
      const hit = resolveFieldRef(ref, q.source);
      if (!hit) continue;
      const reader = this.readers.get(hit.source);
      if (reader && !reader.fields.has(hit.field.id)) return `${hit.field.label} is not available from ${sourceOf(hit.source)!.label.toLowerCase()} yet.`;
    }
    return undefined;
  }

  /** The dimension both sources carry for one join key, so rows can be matched; undefined when they share none. */
  private joinKeys(main: string, other: string): { main: string; joined: string } | undefined {
    for (const join of sharedJoins(main, other) as JoinKey[]) {
      const m = sourceOf(main)!.fields.find((f) => f.role === "DIMENSION" && f.joinKey === join);
      const o = sourceOf(other)!.fields.find((f) => f.role === "DIMENSION" && f.joinKey === join);
      if (m && o) return { main: m.id, joined: o.id };
    }
    return undefined;
  }
}
