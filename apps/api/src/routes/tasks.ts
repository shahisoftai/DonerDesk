import type { FastifyInstance } from "fastify";
import { CompleteTaskSchema, CreateTaskSchema, ListAssignmentsQuerySchema, SetOwnerSchema } from "@donordesk/contracts";

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
}
