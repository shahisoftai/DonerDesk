import { DomainError, buildPages, datasetSourceId, kitOf, matchKit, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { CreateCanvasHandler } from "../canvas/create-canvas.js";
import { fail, loadDataset, ok, type DatasetDeps } from "./dataset-shared.js";

/**
 * "Make dashboards from the kit" (§3.8, J1): one canvas whose pages are the kit's pages built on the dataset's columns. Pages without the
 * data they need are left out and named. The canvas is made through the ordinary canvas create (its access and checks apply) and is
 * an ordinary canvas afterwards: anything on it can be changed.
 */
export class MakeKitDashboardsHandler {
  constructor(private readonly deps: DatasetDeps, private readonly canvases: Pick<CreateCanvasHandler, "handle">) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, input: { kitKey?: string | undefined; title?: string | undefined; pageKeys?: string[] | undefined }): Promise<Result<{ canvasId: string; pages: number; skipped: string[] }, DomainError>> {
    const d = await loadDataset(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    const kit = kitOf(input.kitKey ?? d.value.kitKey ?? "");
    if (!kit) return fail(DomainError.validation("Choose the kit to build the pages from."));
    if (!d.value.currentVersionId) return fail(DomainError.validation("The dataset has no saved rows yet."));
    const v = await this.deps.catalog.findVersion(d.value.currentVersionId, ctx.tenant.tenantId);
    if (!v.ok || !v.value) return fail(DomainError.notFound("Version", d.value.currentVersionId));
    // The mapping saved on the dataset (by header) wins; columns renamed to the kit's wording on the confirm screen also match.
    const match = matchKit(v.value.columns, kit, d.value.kitMapping);
    const built = buildPages({ ...kit, pages: input.pageKeys?.length ? kit.pages.filter((p) => input.pageKeys!.includes(p.key)) : kit.pages }, match.mapping, datasetSourceId(d.value.id));
    if (built.pages.length === 0) return fail(DomainError.validation(`None of the kit's pages can be drawn from this dataset: ${built.skipped[0] ?? "no columns matched"}`));
    const title = (input.title?.trim() || `${d.value.name}: ${kit.title.replace(/ kit$/i, "")}`).slice(0, 120);
    const created = await this.canvases.handle(ctx, { title, scope: d.value.scope === "ORGANISATION" ? "ORG" : "PROJECT", ...(d.value.projectId ? { projectId: d.value.projectId } : {}), pages: built.pages as never, profile: "LIVE_INTERNAL" });
    if (!created.ok) return created;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.kit_dashboards", entityType: "dataset", entityId: datasetId, newValue: JSON.stringify({ kit: kit.key, pages: built.pages.length, skipped: built.skipped.length }) });
    return ok({ canvasId: created.value.id, pages: built.pages.length, skipped: built.skipped });
  }
}
