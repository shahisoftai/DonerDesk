import type { FastifyInstance } from "fastify";
import { PreviewDashboardSchema, SetFeaturedSchema, AddMapOverlaySchema, AddHomePinSchema, MoveHomePinSchema, AddBookmarkSchema, SaveReportSchema, ApplyDashboardTemplateSchema, DashboardTemplateBodySchema, AskQuestionSchema, AddDashboardWidgetSchema, CreateDashboardShareSchema, ListChartsQuerySchema, ListDashboardsQuerySchema, ResolveDatasetsSchema, SaveChartSchema, SaveDashboardSchema } from "@donordesk/contracts";
import { createContainer, type Container } from "@donordesk/infrastructure";

/** Dashboards of saved Data Center charts (Phase 33.8). Thin: validate, call one handler, throw its error; the rules are in the handlers. */
export async function registerChartDashboardRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  // Ask DonorDesk (Phase 33.9): a question put to one project's records.
  app.post("/v1/projects/:projectId/ask", async (req) => {
    const { question } = AskQuestionSchema.parse(req.body);
    const r = await req.container.handlers.askProject.handle(ctx(req), param(req, "projectId"), question);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Datasets (Phase 34.0): figures for charts, tiles and maps, one sheet read per project; the handler checks which projects are visible.
  app.post("/v1/datasets/resolve", async (req) => {
    const { requests } = ResolveDatasetsSchema.parse(req.body);
    const r = await req.container.handlers.resolveDatasets.handle(ctx(req), requests);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Dashboard templates (Phase 34.3): built-in drafts plus the organisation's own; applying one makes a dashboard for a project.
  app.get("/v1/dashboard-templates", async (req) => {
    const r = await req.container.handlers.listDashboardTemplates.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/dashboard-templates", async (req, reply) => {
    const r = await req.container.handlers.saveDashboardTemplate.handle(ctx(req), DashboardTemplateBodySchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.get("/v1/dashboard-templates/:templateId", async (req) => {
    const r = await req.container.handlers.getDashboardTemplate.handle(ctx(req), param(req, "templateId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/dashboard-templates/:templateId", async (req) => {
    const r = await req.container.handlers.saveDashboardTemplate.handle(ctx(req), DashboardTemplateBodySchema.parse(req.body), param(req, "templateId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/dashboard-templates/:templateId", async (req) => {
    const r = await req.container.handlers.deleteDashboardTemplate.handle(ctx(req), param(req, "templateId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.post("/v1/dashboard-templates/:templateId/apply", async (req, reply) => {
    const r = await req.container.handlers.applyDashboardTemplate.handle(ctx(req), param(req, "templateId"), ApplyDashboardTemplateSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  // Saved charts (Phase 34.1): the specification only; figures are drawn from the data sheet when opened.
  app.get("/v1/charts", async (req) => {
    const { projectId } = ListChartsQuerySchema.parse(req.query);
    const r = await req.container.handlers.listSavedCharts.handle(ctx(req), projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/charts", async (req, reply) => {
    const r = await req.container.handlers.saveSavedChart.handle(ctx(req), SaveChartSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.get("/v1/charts/:chartId", async (req) => {
    const r = await req.container.handlers.getSavedChart.handle(ctx(req), param(req, "chartId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/charts/:chartId", async (req) => {
    const r = await req.container.handlers.saveSavedChart.handle(ctx(req), SaveChartSchema.parse(req.body), param(req, "chartId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/charts/:chartId", async (req) => {
    const r = await req.container.handlers.deleteSavedChart.handle(ctx(req), param(req, "chartId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Saved reports (Phase 34.5): the question only; the table is run against the data sheet when opened.
  app.get("/v1/saved-reports", async (req) => {
    const { projectId } = ListChartsQuerySchema.parse(req.query);
    const r = await req.container.handlers.listSavedReports.handle(ctx(req), projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/saved-reports", async (req, reply) => {
    const r = await req.container.handlers.saveSavedReport.handle(ctx(req), SaveReportSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.put("/v1/saved-reports/:reportId", async (req) => {
    const r = await req.container.handlers.saveSavedReport.handle(ctx(req), SaveReportSchema.parse(req.body), param(req, "reportId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/saved-reports/:reportId", async (req) => {
    const r = await req.container.handlers.deleteSavedReport.handle(ctx(req), param(req, "reportId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Map overlays: context layers (rivers, roads, a camp outline) the organisation keeps and ticks per map (Phase 35).
  app.get("/v1/map-overlays", async (req) => {
    const r = await req.container.handlers.listMapOverlays.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/map-overlays", { bodyLimit: 7_000_000 }, async (req, reply) => {
    const r = await req.container.handlers.addMapOverlay.handle(ctx(req), AddMapOverlaySchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.get("/v1/map-overlays/:overlayId/data", async (req, reply) => {
    const r = await req.container.handlers.readMapOverlay.handle(ctx(req), param(req, "overlayId"));
    if (!r.ok) throw r.error;
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("cache-control", "private, no-store");
    return reply.send(r.value);
  });
  app.delete("/v1/map-overlays/:overlayId", async (req) => {
    const r = await req.container.handlers.removeMapOverlay.handle(ctx(req), param(req, "overlayId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // A dashboard shown on everyone's Home (Phase 35): who may change it is `org.manage`, checked in the handler.
  app.get("/v1/dashboards/:dashboardId/featured", async (req) => {
    const r = await req.container.handlers.isDashboardFeatured.handle(ctx(req), param(req, "dashboardId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/dashboards/:dashboardId/featured", async (req) => {
    const r = await req.container.handlers.setDashboardFeatured.handle(ctx(req), param(req, "dashboardId"), SetFeaturedSchema.parse(req.body).audiences);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Pinned tiles on the caller's own Home (Phase 35.H4).
  app.get("/v1/home-pins", async (req) => {
    const r = await req.container.handlers.listHomePins.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/home-pins", async (req, reply) => {
    const r = await req.container.handlers.addHomePin.handle(ctx(req), AddHomePinSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.put("/v1/home-pins/:pinId/position", async (req) => {
    const r = await req.container.handlers.moveHomePin.handle(ctx(req), param(req, "pinId"), MoveHomePinSchema.parse(req.body).to);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.delete("/v1/home-pins/:pinId", async (req) => {
    const r = await req.container.handlers.removeHomePin.handle(ctx(req), param(req, "pinId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Bookmarks (Phase 34.7): the caller's own shortcuts.
  app.get("/v1/bookmarks", async (req) => {
    const r = await req.container.handlers.listBookmarks.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/bookmarks", async (req, reply) => {
    const r = await req.container.handlers.addBookmark.handle(ctx(req), AddBookmarkSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.delete("/v1/bookmarks/:bookmarkId", async (req) => {
    const r = await req.container.handlers.removeBookmark.handle(ctx(req), param(req, "bookmarkId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/dashboards", async (req) => {
    const { projectId } = ListDashboardsQuerySchema.parse(req.query);
    const r = await req.container.handlers.listDashboards.handle(ctx(req), projectId);
    if (!r.ok) throw r.error;
    return { dashboards: r.value };
  });

  app.post("/v1/dashboards", async (req, reply) => {
    const r = await req.container.handlers.saveDashboard.handle(ctx(req), SaveDashboardSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.get("/v1/dashboards/:dashboardId", async (req) => {
    const r = await req.container.handlers.getDashboard.handle(ctx(req), param(req, "dashboardId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/dashboards/:dashboardId", async (req) => {
    const r = await req.container.handlers.saveDashboard.handle(ctx(req), SaveDashboardSchema.parse(req.body), param(req, "dashboardId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/dashboards/:dashboardId", async (req) => {
    const r = await req.container.handlers.deleteDashboard.handle(ctx(req), param(req, "dashboardId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/dashboards/:dashboardId/charts", async (req, reply) => {
    const r = await req.container.handlers.addDashboardWidget.handle(ctx(req), param(req, "dashboardId"), AddDashboardWidgetSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  // Draws widgets that are not saved yet (a tile just added in edit mode): read-only, same visibility rules as a saved dashboard.
  app.post("/v1/dashboard-preview", async (req) => {
    const { widgets, periodId } = PreviewDashboardSchema.parse(req.body);
    const r = await req.container.handlers.previewDashboardCharts.handle(ctx(req), widgets as never, periodId ? { periodId } : {});
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/dashboards/:dashboardId/data", async (req) => {
    const r = await req.container.handlers.getDashboardData.handle(ctx(req), param(req, "dashboardId"), (() => { const id = (req.query as { periodId?: unknown }).periodId; return typeof id === "string" && id !== "" ? { periodId: id } : {}; })());
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/dashboards/:dashboardId/links", async (req) => {
    const r = await req.container.handlers.listDashboardShares.handle(ctx(req), param(req, "dashboardId"));
    if (!r.ok) throw r.error;
    return { links: r.value };
  });

  app.post("/v1/dashboards/:dashboardId/links", async (req, reply) => {
    const r = await req.container.handlers.createDashboardShare.handle(ctx(req), param(req, "dashboardId"), CreateDashboardShareSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.post("/v1/dashboard-links/:linkId/revoke", async (req) => {
    const r = await req.container.handlers.revokeDashboardShare.handle(ctx(req), param(req, "linkId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}

/**
 * The public read of a dashboard share link: no session, no cookies, outside the authenticated scope. The token is looked up on the
 * admin container; the dashboard is then drawn on the organisation's own container as an outside guest, without finance. Unknown,
 * expired and revoked links all answer 404, and nothing is cached by shared caches.
 */
export async function registerPublicDashboardRoutes(app: FastifyInstance, admin: Container) {
  app.get("/public/dashboards/:token", async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    const link = await admin.resolveDashboardShare.handle((req.params as { token: string }).token);
    if (!link.ok) { reply.code(404); return { title: "This link is not available" }; }
    const tenant = createContainer({ tenantId: link.value.tenantId.toString() });
    const r = await tenant.handlers.publicDashboard.handle(link.value.tenantId, link.value.dashboardId);
    if (!r.ok) { reply.code(404); return { title: "This link is not available" }; }
    return r.value;
  });
}
