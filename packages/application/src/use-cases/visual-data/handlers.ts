import { DATA_SOURCES, DomainError, Permissions, searchFields, type DataSourceDef, type FieldHit, type Result, type Role, type VisualQuery } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDataVersions } from "../../ports/visual-data.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { SourceReader } from "./source-readers.js";
import type { DatasetSourceProvider, VisualAnswer, VisualDataService } from "./visual-data-service.js";

const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const canView = (ctx: AuthenticatedContext): boolean => Permissions.can(ctx.tenant.role as Role, "project.view");

export class QueryVisualDataHandler {
  constructor(private readonly service: Pick<VisualDataService, "query">) {}
  handle(ctx: AuthenticatedContext, projectId: string, query: VisualQuery): Promise<Result<VisualAnswer, DomainError>> {
    if (!canView(ctx)) return Promise.resolve(fail(DomainError.forbidden("You cannot see project data")));
    return this.service.query(ctx, projectId, query);
  }
}

export interface CatalogueSourceView {
  id: string; label: string; description: string; grain: string; guest: boolean;
  /** The person's role may open it. */
  allowed: boolean;
  /** Fields a reader fills today; the others are listed as "coming". */
  fields: Array<DataSourceDef["fields"][number] & { available: boolean }>;
  /** false = no reader yet ("being connected"). */
  connected: boolean;
  /** A dataset the organisation brought in (Phase 54). */
  dataset?: boolean;
}

/** What the Data panel shows: every source, whether the person may open it, and which fields are really readable today. */
export class GetVisualDataCatalogueHandler {
  constructor(private readonly readers: ReadonlyArray<Pick<SourceReader, "source" | "fields">>, private readonly datasets?: Pick<DatasetSourceProvider, "catalogueFor">) {}
  /** Datasets the person can see are listed first (§4.1), then the built-in sources. */
  async handle(ctx: AuthenticatedContext, search?: string, projectId?: string): Promise<Result<{ sources: CatalogueSourceView[]; hits: Array<Pick<FieldHit, "score"> & { source: string; field: string }> }, DomainError>> {
    if (!canView(ctx)) return fail(DomainError.forbidden("You cannot see project data"));
    const role = ctx.tenant.role as Role;
    const byId = new Map(this.readers.map((r) => [r.source, r]));
    const cat = this.datasets ? await this.datasets.catalogueFor(ctx, projectId) : DATA_SOURCES;
    const own = new Set(DATA_SOURCES.map((s) => s.id));
    const ordered = [...cat.filter((s) => !own.has(s.id)), ...DATA_SOURCES];
    const sources = ordered.map((s): CatalogueSourceView => {
      const dataset = !own.has(s.id);
      const reader = byId.get(s.id);
      return { id: s.id, label: s.label, description: s.description, grain: s.grain, guest: s.guest, allowed: Permissions.can(role, s.permission), connected: dataset || Boolean(reader), dataset, fields: s.fields.map((f) => ({ ...f, available: dataset || (reader?.fields.has(f.id) ?? false) })) };
    });
    const hits = search ? searchFields(search, 25, cat).map((h) => ({ source: h.source.id, field: h.field.id, score: h.score })) : [];
    return { ok: true, value: { sources, hits } };
  }
}

export class GetVisualDataVersionHandler {
  constructor(private readonly versions: IDataVersions, private readonly visible: Pick<VisibleProjects, "for">) {}
  /** The versions of the named projects the person can see; others are left out, not answered. */
  async handle(ctx: AuthenticatedContext, projectIds: ReadonlyArray<string>): Promise<Result<{ projects: Array<{ projectId: string; epoch: string; versions: Record<string, number> }> }, DomainError>> {
    if (!canView(ctx)) return fail(DomainError.forbidden("You cannot see project data"));
    if (projectIds.length === 0 || projectIds.length > 25) return fail(DomainError.validation("Ask for between 1 and 25 projects."));
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const allowed = new Set(mine.value.map((p) => p.id));
    const projects = [];
    for (const projectId of projectIds.filter((id) => allowed.has(id))) {
      const state = await this.versions.read(ctx.tenant.tenantId.toString(), projectId);
      projects.push({ projectId, epoch: state.epoch, versions: { ...state.versions } });
    }
    return { ok: true, value: { projects } };
  }
}
