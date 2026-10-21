import type { FastifyInstance } from "fastify";
import { managementReportCsv, rollupTable, toCsv } from "@donordesk/domain";
import { SetEntryDueDaysSchema, CloseRiskSchema, CreateRiskSchema, UpdateRiskSchema, UpdateNotificationPreferencesSchema, CompleteTaskSchema, CreateTaskSchema, ListAssignmentsQuerySchema, SetOwnerSchema } from "@donordesk/contracts";

/**
 * Requests, the assignment queue, the team view and the three "Lead" pickers. Thin: validate, call one handler, throw its error.
 * Permissions are in the handlers (and, where one permission covers a route, in the authorization table too).
 */
export async function registerTaskRoutes(app: FastifyInstance) {
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  app.get("/v1/me/assignments", async (req) => {
    const query = ListAssignmentsQuerySchema.parse(req.query);
    const r = await req.container.handlers.listAssignments.handle({ tenant: req.tenant, requestId: req.id }, query);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // How a project stands: a label with its two biggest reasons (no score). One line per visible project for the portfolio.
  app.get("/v1/projects/:projectId/delivery-health", async (req) => {
    const r = await req.container.handlers.getDeliveryHealth.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Indicators summed across the projects a person can see, per donor and code (phase 28.1-F). Only verified values count.
  // The same roll-up as a CSV for donors: the same visibility rule (a person only gets the projects they are on), nothing recomputed.
  app.get("/v1/portfolio/indicators/export", async (req, reply) => {
    const r = await req.container.handlers.getPortfolioIndicators.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", 'attachment; filename="indicators-across-projects.csv"');
    return toCsv(rollupTable(r.value));
  });

  // The standard management report of one project: as tables, and as a CSV.
  app.get("/v1/projects/:projectId/management-report", async (req) => {
    const r = await req.container.handlers.getManagementReport.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { projectId: string }).projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/management-report/export", async (req, reply) => {
    const r = await req.container.handlers.getManagementReport.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { projectId: string }).projectId);
    if (!r.ok) throw r.error;
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="management-report-${r.value.today}.csv"`);
    return managementReportCsv(r.value.sections);
  });

  app.get("/v1/portfolio/indicators", async (req) => {
    const r = await req.container.handlers.getPortfolioIndicators.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/portfolio/health", async (req) => {
    const r = await req.container.handlers.getPortfolioHealth.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  // The portfolio dashboard: delivery, problems and risks, and reporting, one row per project the person can see.
  app.get("/v1/portfolio/overview", async (req) => {
    const r = await req.container.handlers.getPortfolioOverview.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Days after a period ends that indicator values are due (default 5). Anyone on the project reads it; project editors set it.
  app.get("/v1/projects/:projectId/entry-due-days", async (req) => {
    const r = await req.container.handlers.getEntryDueDays.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { projectId: string }).projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:projectId/entry-due-days", async (req) => {
    const body = SetEntryDueDaysSchema.parse(req.body);
    const r = await req.container.handlers.setEntryDueDays.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { projectId: string }).projectId, body.days);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/risk-trend", async (req) => {
    const r = await req.container.handlers.getRiskTrend.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"));
    if (!r.ok) throw r.error;
    return { trend: r.value };
  });

  app.get("/v1/projects/:projectId/team-work", async (req) => {
    const r = await req.container.handlers.listTeamWork.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/tasks", async (req) => {
    const body = CreateTaskSchema.parse(req.body);
    const r = await req.container.handlers.createTask.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/tasks/:taskId/complete", async (req) => {
    const body = CompleteTaskSchema.parse(req.body ?? {});
    const r = await req.container.handlers.completeTask.handle({ tenant: req.tenant, requestId: req.id }, param(req, "taskId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/tasks/:taskId/cancel", async (req) => {
    const r = await req.container.handlers.cancelTask.handle({ tenant: req.tenant, requestId: req.id }, param(req, "taskId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/indicators/:indicatorId/owner", async (req) => {
    const body = SetOwnerSchema.parse(req.body);
    const r = await req.container.handlers.setIndicatorOwner.handle({ tenant: req.tenant, requestId: req.id }, param(req, "indicatorId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/periods/:periodId/owner", async (req) => {
    const body = SetOwnerSchema.parse(req.body);
    const r = await req.container.handlers.setPeriodOwner.handle({ tenant: req.tenant, requestId: req.id }, param(req, "periodId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/checklist/:itemId/assign", async (req) => {
    const body = SetOwnerSchema.parse(req.body);
    const r = await req.container.handlers.assignChecklistItem.handle({ tenant: req.tenant, requestId: req.id }, param(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // The only reminder setting: how I want to be emailed. Always about the caller.
  app.get("/v1/me/notification-preferences", async (req) => {
    const r = await req.container.handlers.getNotificationPreferences.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/me/notification-preferences", async (req) => {
    const body = UpdateNotificationPreferencesSchema.parse(req.body);
    const r = await req.container.handlers.updateNotificationPreferences.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Problems and risks: a short list on the project Overview. Who may change one is decided in the handler (the person
  // handling it, the one who raised it, or a manager), so only the list and raising are in the permission table.
  app.get("/v1/projects/:projectId/risks", async (req) => {
    const r = await req.container.handlers.listRisks.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects/:projectId/risks", async (req) => {
    const body = CreateRiskSchema.parse(req.body);
    const r = await req.container.handlers.createRisk.handle({ tenant: req.tenant, requestId: req.id }, param(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/risks/:riskId", async (req) => {
    const body = UpdateRiskSchema.parse(req.body);
    const r = await req.container.handlers.updateRisk.handle({ tenant: req.tenant, requestId: req.id }, param(req, "riskId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/risks/:riskId/close", async (req) => {
    const body = CloseRiskSchema.parse(req.body ?? {});
    const r = await req.container.handlers.closeRisk.handle({ tenant: req.tenant, requestId: req.id }, param(req, "riskId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
