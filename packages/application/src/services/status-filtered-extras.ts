import { restrictPlanToStatus, type DatasetPlanRow } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IDatasetExtras } from "./dataset-extras.js";

/** The same extras with the planned work narrowed to one status: everything built from the plan (counts, pins, timelines) follows. */
export class StatusFilteredExtras implements IDatasetExtras {
  constructor(private readonly inner: IDatasetExtras, private readonly status: string) {}
  async plan(ctx: AuthenticatedContext, projectId: string): Promise<DatasetPlanRow[] | undefined> {
    const rows = await this.inner.plan(ctx, projectId);
    return rows ? restrictPlanToStatus(rows, this.status) : rows;
  }
  activityDays(ctx: AuthenticatedContext, projectId: string) { return this.inner.activityDays(ctx, projectId); }
  flows(ctx: AuthenticatedContext, projectId: string) { return this.inner.flows?.(ctx, projectId) ?? Promise.resolve(undefined); }
  budget(ctx: AuthenticatedContext, projectId: string) { return this.inner.budget(ctx, projectId); }
  places(ctx: AuthenticatedContext, projectId: string, indicatorId: string, level: Parameters<IDatasetExtras["places"]>[3]) { return this.inner.places(ctx, projectId, indicatorId, level); }
  finance(ctx: AuthenticatedContext, projectId: string) { return this.inner.finance(ctx, projectId); }
  visibleProjects(ctx: AuthenticatedContext) { return this.inner.visibleProjects(ctx); }
  bookmarkedProjectIds(ctx: AuthenticatedContext) { return this.inner.bookmarkedProjectIds(ctx); }
}
