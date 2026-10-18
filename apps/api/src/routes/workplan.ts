import type { FastifyInstance } from "fastify";
import {
  AssignPlannedActivitySchema, ImportWorkPlanSchema, SetWorkPlanningVisibilitySchema, ChangePlanStatusSchema, CreatePlannedActivitySchema, ListWorkPlanQuerySchema,
  ReschedulePlannedActivitySchema, StartPlanFromLogframeSchema, UpdatePlannedActivitySchema,
} from "@donordesk/contracts";

/**
 * Thin routes: validate with Zod, call one handler, throw its error. Who may do what lives in the handlers
 * (`PlanAccess`, from the domain's `canActOnPlanItem`); manager-only routes are also in the authorization table.
 */
export async function registerWorkPlanRoutes(app: FastifyInstance) {
  const idOf = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  // Always the caller's own week: the handler takes no user id, so there is no way to ask for someone else's.
  app.get("/v1/me/week", async (req) => {
    const r = await req.container.handlers.getMyWeek.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/work-plan", async (req) => {
    const query = ListWorkPlanQuerySchema.parse(req.query);
    const r = await req.container.handlers.listWorkPlan.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), query);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects/:projectId/work-plan", async (req) => {
    const body = CreatePlannedActivitySchema.parse(req.body);
    const r = await req.container.handlers.createPlannedActivity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/work-plan/from-logframe", async (req) => {
    const body = StartPlanFromLogframeSchema.parse(req.body ?? {});
    const r = await req.container.handlers.startPlanFromLogframe.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/work-plan/import", async (req) => {
    const body = ImportWorkPlanSchema.parse(req.body);
    const r = await req.container.handlers.importWorkPlan.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Same pattern as the other imports: a file becomes text, which the person can edit before importing.
  app.post("/v1/work-plan/parse-file", async (req) => {
    const data = await req.file();
    if (!data) throw new Error("file required");
    const result = await req.container.parser.parse({ buffer: await data.toBuffer(), fileName: data.filename ?? "upload", fileType: data.mimetype ?? "application/octet-stream" });
    return { text: result.text, metadata: result.metadata };
  });

  app.get("/v1/work-plan/:itemId/revisions", async (req) => {
    const r = await req.container.handlers.listPlanRevisions.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.put("/v1/work-plan/:itemId", async (req) => {
    const body = UpdatePlannedActivitySchema.parse(req.body);
    const r = await req.container.handlers.updatePlannedActivity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/work-plan/:itemId/status", async (req) => {
    const body = ChangePlanStatusSchema.parse(req.body);
    const r = await req.container.handlers.changePlanStatus.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/work-plan/:itemId/reschedule", async (req) => {
    const body = ReschedulePlannedActivitySchema.parse(req.body);
    const r = await req.container.handlers.reschedulePlannedActivity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/work-plan/:itemId/assign", async (req) => {
    const body = AssignPlannedActivitySchema.parse(req.body);
    const r = await req.container.handlers.assignPlannedActivity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/projects/:projectId/work-planning", async (req) => {
    const body = SetWorkPlanningVisibilitySchema.parse(req.body);
    const r = await req.container.handlers.setWorkPlanningVisibility.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body.show);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
