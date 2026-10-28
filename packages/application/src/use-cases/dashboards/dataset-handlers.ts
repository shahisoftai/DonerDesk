import { DomainError, Permissions, groupByProject, resolveDataset, type DatasetQuery, type DatasetResult, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";

/**
 * Datasets (Phase 34.0): the one call a chart, a tile or a map makes to get figures from a project's data sheet. Each request is a
 * query against one project; the sheet of a project is read once however many requests name it. A request for a project the
 * person cannot see is answered "from a project you cannot see": never hidden and never drawn, and its sheet is not read.
 */

export interface DatasetRequest {
  key: string;
  projectId: string;
  query: DatasetQuery;
}

export type DatasetAnswer = { key: string; dataset: DatasetResult } | { key: string; unavailable: string };

export const MAX_DATASET_REQUESTS = 24;

const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });

export class ResolveDatasetsHandler {
  constructor(private readonly sheets: Pick<GetProjectDataSheetHandler, "handle">, private readonly visible: Pick<VisibleProjects, "for">, private readonly extras?: IDatasetExtras) {}

  async handle(ctx: AuthenticatedContext, requests: ReadonlyArray<DatasetRequest>): Promise<Result<{ datasets: DatasetAnswer[] }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return fail(DomainError.forbidden("You cannot see project data"));
    if (requests.length === 0) return { ok: true, value: { datasets: [] } };
    if (requests.length > MAX_DATASET_REQUESTS) return fail(DomainError.validation(`Ask for at most ${MAX_DATASET_REQUESTS} datasets at a time.`));
    if (new Set(requests.map((r) => r.key)).size !== requests.length) return fail(DomainError.validation("Two requests share a key."));

    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const allowed = new Set(mine.value.map((p) => p.id));

    const answers = new Map<string, DatasetAnswer>();
    for (const group of groupByProject(requests)) {
      if (!allowed.has(group.projectId)) {
        for (const r of group.requests) answers.set(r.key, { key: r.key, unavailable: "This is from a project you cannot see." });
        continue;
      }
      const sheet = await this.sheets.handle(ctx, group.projectId);
      for (const r of group.requests) {
        if (!sheet.ok) { answers.set(r.key, { key: r.key, unavailable: "The data for this could not be read." }); continue; }
        const dataset = resolveDataset(sheet.value, r.query);
        // Extra data only for what the chart asked for: the plan, the days, the budget. Unreadable stays undefined (never an empty list).
        const wanted = new Set(r.query.sources ?? []);
        if (this.extras && wanted.size > 0) {
          if (wanted.has("PLAN")) dataset.plan = await this.extras.plan(ctx, group.projectId);
          if (wanted.has("ACTIVITY_DAYS")) dataset.activityDays = await this.extras.activityDays(ctx, group.projectId);
          if (wanted.has("BUDGET")) dataset.budget = await this.extras.budget(ctx, group.projectId);
          if (wanted.has("PLACES")) dataset.places = await this.extras.places(ctx, group.projectId, r.query.indicatorIds[0] ?? "", r.query.placeLevel ?? 1);
        }
        answers.set(r.key, { key: r.key, dataset });
      }
    }
    // Answers come back in the order they were asked.
    return { ok: true, value: { datasets: requests.map((r) => answers.get(r.key)!) } };
  }
}
