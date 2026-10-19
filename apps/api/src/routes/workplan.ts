import type { FastifyInstance } from "fastify";
import {
  AssignPlannedActivitySchema, ImportWorkPlanSchema, SetWorkPlanningVisibilitySchema, ChangePlanStatusSchema, CreatePlannedActivitySchema, ListWorkPlanQuerySchema,
  ReschedulePlannedActivitySchema, StartPlanFromLogframeSchema, UpdatePlannedActivitySchema, AddPlanDependencySchema, DefineProjectFieldSchema, SetPlanItemFieldsSchema, AddBudgetLineSchema, AddBudgetExpenseSchema, BulkPlanActionSchema, UndoBulkPlanActionSchema, SetCapacitySchema, SetAutomationRuleSchema, RegisterBeneficiarySchema, ImportSubmissionsSchema, ImportSubmissionsWithMappingSchema, SubmissionMappingSchema, SetPlanIndicatorsSchema, SaveProgressSchema, ChangeActivityPeopleSchema, CompletePlannedActivitySchema,
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

  app.get("/v1/projects/:projectId/plan-field-values", async (req) => {
    const r = await req.container.handlers.listProjectFieldValues.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/plan-fields", async (req) => {
    const r = await req.container.handlers.listProjectFields.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects/:projectId/plan-fields", async (req) => {
    const body = DefineProjectFieldSchema.parse(req.body);
    const r = await req.container.handlers.defineProjectField.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/work-plan/:itemId/fields", async (req) => {
    const r = await req.container.handlers.getPlanItemFields.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/work-plan/:itemId/fields", async (req) => {
    const body = SetPlanItemFieldsSchema.parse(req.body);
    const r = await req.container.handlers.setPlanItemFields.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Many activities at once: preview first (apply false), then apply. Refusals name the reason and change nothing.
  app.post("/v1/projects/:projectId/work-plan/bulk", async (req) => {
    const body = BulkPlanActionSchema.parse(req.body);
    const r = await req.container.handlers.bulkPlanAction.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Puts activities back as they were, from the steps a bulk change returned.
  app.post("/v1/projects/:projectId/work-plan/bulk/undo", async (req) => {
    const body = UndoBulkPlanActionSchema.parse(req.body);
    const r = await req.container.handlers.undoBulkPlanAction.handle({ tenant: req.tenant, requestId: req.id }, body.steps);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/workload", async (req) => {
    const r = await req.container.handlers.getWorkload.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/users/:userId/capacity", async (req) => {
    const body = SetCapacitySchema.parse(req.body);
    const r = await req.container.handlers.setCapacity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "userId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/projects/:projectId/automations", async (req) => {
    const r = await req.container.handlers.listAutomationRules.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.put("/v1/projects/:projectId/automations/:ruleKey", async (req) => {
    const body = SetAutomationRuleSchema.parse(req.body);
    const r = await req.container.handlers.setAutomationRule.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), idOf(req, "ruleKey"), body.enabled);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/projects/:projectId/beneficiaries", async (req) => {
    const r = await req.container.handlers.listBeneficiaries.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/submission-mapping", async (req) => {
    const r = await req.container.handlers.getSubmissionMapping.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:projectId/submission-mapping", async (req) => {
    const body = SubmissionMappingSchema.parse(req.body);
    const r = await req.container.handlers.saveSubmissionMapping.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/projects/:projectId/beneficiaries/import/preview", async (req) => {
    const body = ImportSubmissionsWithMappingSchema.parse(req.body);
    const r = await req.container.handlers.previewSubmissions.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body.csv, body.mapping);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/beneficiaries/import", async (req) => {
    const body = ImportSubmissionsWithMappingSchema.parse(req.body);
    const r = await req.container.handlers.importSubmissions.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body.csv, body.mapping);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/beneficiaries", async (req) => {
    const body = RegisterBeneficiarySchema.parse(req.body);
    const r = await req.container.handlers.registerBeneficiary.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/beneficiaries/:id", async (req) => {
    const body = RegisterBeneficiarySchema.parse(req.body);
    const r = await req.container.handlers.updateBeneficiary.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "id"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.delete("/v1/beneficiaries/:id", async (req) => {
    const r = await req.container.handlers.removeBeneficiary.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "id"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/work-plan/:itemId/indicators", async (req) => {
    const body = SetPlanIndicatorsSchema.parse(req.body);
    const r = await req.container.handlers.setPlanIndicators.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/work-plan/:itemId/people", async (req) => {
    const r = await req.container.handlers.getActivityPeople.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/work-plan/:itemId/people", async (req) => {
    const body = ChangeActivityPeopleSchema.parse(req.body);
    const r = await req.container.handlers.changeActivityPeople.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/work-plan/:itemId/progress", async (req) => {
    const r = await req.container.handlers.getProgress.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/work-plan/:itemId/progress/prepare", async (req) => {
    const q = req.query as { kind?: string; key?: string };
    const kind = q.kind ?? "";
    if (!["DAILY", "WEEKLY", "MONTHLY", "END"].includes(kind)) throw new Error("Choose daily, weekly, monthly or activity end");
    const r = await req.container.handlers.prepareProgress.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), kind as "DAILY" | "WEEKLY" | "MONTHLY" | "END", q.key ?? "");
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/work-plan/:itemId/progress", async (req) => {
    const body = SaveProgressSchema.parse(req.body);
    const r = await req.container.handlers.saveProgress.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/work-plan/:itemId/progress/:entryId", async (req) => {
    const r = await req.container.handlers.removeProgress.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), idOf(req, "entryId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // Targets by group beside the verified figure so far, per indicator that has them.
  app.get("/v1/projects/:projectId/breakdown-progress", async (req) => {
    const r = await req.container.handlers.getBreakdownProgress.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/projects/:projectId/budget", async (req) => {
    const r = await req.container.handlers.getProjectBudget.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/work-plan/:itemId/budget", async (req) => {
    const r = await req.container.handlers.getPlanItemBudget.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/work-plan/:itemId/budget-lines", async (req) => {
    const body = AddBudgetLineSchema.parse(req.body);
    const r = await req.container.handlers.addBudgetLine.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/work-plan/:itemId/budget-lines/:lineId/expenses", async (req) => {
    const body = AddBudgetExpenseSchema.parse(req.body);
    const r = await req.container.handlers.addBudgetExpense.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), idOf(req, "lineId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/work-plan/dependencies", async (req) => {
    const body = AddPlanDependencySchema.parse(req.body);
    const r = await req.container.handlers.addPlanDependency.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/work-plan/dependencies/:predecessorId/:successorId", async (req) => {
    const params = req.params as { predecessorId: string; successorId: string };
    const r = await req.container.handlers.removePlanDependency.handle({ tenant: req.tenant, requestId: req.id }, { predecessorId: params.predecessorId, successorId: params.successorId });
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // One step: records the completed activity and marks the plan item done. Refusals change nothing.
  app.post("/v1/work-plan/:itemId/complete", async (req) => {
    const body = CompletePlannedActivitySchema.parse(req.body);
    const r = await req.container.handlers.completePlannedActivity.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "itemId"), body);
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
