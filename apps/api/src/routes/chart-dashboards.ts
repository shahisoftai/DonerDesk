import type { FastifyInstance } from "fastify";
import { AskQuestionSchema, AddDashboardWidgetSchema, CreateDashboardShareSchema, ListDashboardsQuerySchema, SaveDashboardSchema } from "@donordesk/contracts";
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

  app.get("/v1/dashboards/:dashboardId/data", async (req) => {
    const r = await req.container.handlers.getDashboardData.handle(ctx(req), param(req, "dashboardId"));
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
