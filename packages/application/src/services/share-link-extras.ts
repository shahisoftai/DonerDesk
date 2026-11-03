import type { Project, Result, DomainError, TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IProjectRepository } from "../ports/projects.js";
import type { IDatasetExtras } from "./dataset-extras.js";

/**
 * What a dashboard share link may show beyond the indicator figures. A link is a bearer credential held by someone with no account, so it
 * is narrower than a signed-in view: the plan (counts, delivery state, locations), completed-activity days and results by place go out;
 * **money never does** (the page promises it), nor does the budget, the list of projects or a person's bookmarks.
 */
export class ShareLinkExtras implements IDatasetExtras {
  constructor(private readonly inner: IDatasetExtras) {}
  plan(ctx: AuthenticatedContext, projectId: string) { return this.inner.plan(ctx, projectId); }
  activityDays(ctx: AuthenticatedContext, projectId: string) { return this.inner.activityDays(ctx, projectId); }
  places(ctx: AuthenticatedContext, projectId: string, indicatorId: string, level: number) { return this.inner.places(ctx, projectId, indicatorId, level); }
  async budget() { return undefined; }
  async finance() { return undefined; }
  async visibleProjects() { return undefined; }
  async bookmarkedProjectIds() { return new Set<string>(); }
}

/** The data a map card shows, read once on the server for a share link (a link holder has no session to read it with later). */
export interface IShareMapReader {
  /** The organisation's places, as the places screen returns them. */
  places(ctx: AuthenticatedContext): Promise<unknown | undefined>;
  /** One project's results by place at the province level, as the Data Center returns them. */
  results(ctx: AuthenticatedContext, projectId: string): Promise<unknown | undefined>;
  /** One project's planned activities and its country, as the plan's map reads them. */
  activities(ctx: AuthenticatedContext, projectId: string): Promise<{ rows: unknown[]; country?: string } | undefined>;
}

export class ShareMapReader implements IShareMapReader {
  constructor(
    private readonly listPlaces: { handle(ctx: AuthenticatedContext, options?: { includeArchived?: boolean }): Promise<Result<unknown, DomainError>> },
    private readonly placeResults: { handle(ctx: AuthenticatedContext, projectId: string, level: 1): Promise<Result<unknown, DomainError>> },
    private readonly listPlan: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown[], DomainError>> },
    private readonly projects: Pick<IProjectRepository, "findById">,
  ) {}

  async places(ctx: AuthenticatedContext) { const r = await this.listPlaces.handle(ctx); return r.ok ? r.value : undefined; }
  async results(ctx: AuthenticatedContext, projectId: string) { const r = await this.placeResults.handle(ctx, projectId, 1); return r.ok ? r.value : undefined; }
  async activities(ctx: AuthenticatedContext, projectId: string) {
    const rows = await this.listPlan.handle(ctx, projectId);
    if (!rows.ok) return undefined;
    const project = await this.projects.findById(projectId, ctx.tenant.tenantId as TenantId);
    const country = project.ok ? (project.value as Project | null)?.country : undefined;
    return { rows: rows.value, ...(country ? { country } : {}) };
  }
}
