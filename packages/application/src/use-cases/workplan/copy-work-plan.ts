import { DomainError, PlannedActivity, planWorkPlanCopy, toPlainDate, err, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export interface CopyWorkPlanResult {
  plannedActivities: number;
  skipped: Array<{ title: string; reason: string }>;
}

/**
 * Copies a project's work plan into another project's (run after its logframe was copied): titles, logframe activities
 * (matched by code), lengths and offsets from the new project's start. No leads, statuses or completed activities.
 * Refuses a target that already has a plan, so nothing is duplicated or merged.
 */
export class CopyWorkPlanHandler {
  constructor(
    private readonly projects: IProjectRepository, private readonly logframe: ILogframeRepository, private readonly plans: IPlannedActivityRepository,
    private readonly ids: IIdGenerator, private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: { sourceProjectId: string; targetProjectId: string }): Promise<Result<CopyWorkPlanResult, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId = ctx.tenant.tenantId;
    const [source, target] = await Promise.all([this.projects.findById(input.sourceProjectId, tenantId), this.projects.findById(input.targetProjectId, tenantId)]);
    if (!source.ok) return source;
    if (!target.ok) return target;
    if (!source.value) return err(DomainError.notFound("Project", input.sourceProjectId));
    if (!target.value) return err(DomainError.notFound("Project", input.targetProjectId));

    const existing = await this.plans.findByProject(input.targetProjectId, tenantId);
    if (!existing.ok) return existing;
    if (existing.value.length > 0) return err(DomainError.validation("This project already has planned activities. Copying is only offered into an empty plan."));
    const sourcePlan = await this.plans.findByProject(input.sourceProjectId, tenantId);
    if (!sourcePlan.ok) return sourcePlan;
    if (sourcePlan.value.length === 0) return err(DomainError.validation("The project you chose has no planned activities to copy."));

    const [srcNodes, dstNodes] = await Promise.all([this.logframe.findByProject(input.sourceProjectId, tenantId), this.logframe.findByProject(input.targetProjectId, tenantId)]);
    if (!srcNodes.ok) return srcNodes;
    if (!dstNodes.ok) return dstNodes;
    const targetByCode = new Map(dstNodes.value.filter((n) => n.level === "ACTIVITY" && n.code).map((n) => [n.code!.toLowerCase(), n]));
    const nodeMap = new Map<string, string>();
    for (const n of srcNodes.value) {
      const twin = n.level === "ACTIVITY" && n.code ? targetByCode.get(n.code.toLowerCase()) : undefined;
      if (twin) nodeMap.set(n.id, twin.id);
    }
    const nodeById = new Map(dstNodes.value.map((n) => [n.id, n]));

    const plan = planWorkPlanCopy(
      sourcePlan.value.map((p) => {
        const s = p.snapshot();
        return { title: s.title, description: s.description, ...(s.location ? { location: s.location } : {}), ...(s.logframeActivityId ? { logframeActivityId: s.logframeActivityId } : {}), plannedStart: s.originalStart, plannedEnd: s.originalEnd, ...(s.targetParticipants !== undefined ? { targetParticipants: s.targetParticipants } : {}), ...(s.targetCount !== undefined ? { targetCount: s.targetCount } : {}), status: s.status };
      }),
      { start: toPlainDate(source.value.duration.start)! },
      { start: toPlainDate(target.value.duration.start)!, end: toPlainDate(target.value.duration.end)! },
      nodeMap,
    );
    if (plan.items.length === 0) return err(DomainError.validation("None of the planned activities fit the new project's dates."));

    const created: PlannedActivity[] = [];
    for (const item of plan.items) {
      const node = item.logframeActivityId ? nodeById.get(item.logframeActivityId) : undefined;
      const made = PlannedActivity.create({
        id: this.ids.generate(), tenantId: tenantId.toString(), projectId: input.targetProjectId, title: item.title, description: item.description,
        plannedStart: item.plannedStart, plannedEnd: item.plannedEnd, createdById: ctx.tenant.userId,
        ...(item.location ? { location: item.location } : {}),
        ...(item.logframeActivityId ? { logframeActivityId: item.logframeActivityId } : {}), ...(node?.parentId ? { outputId: node.parentId } : {}),
        ...(item.targetParticipants !== undefined ? { targetParticipants: item.targetParticipants } : {}), ...(item.targetCount !== undefined ? { targetCount: item.targetCount } : {}),
      });
      if (!made.ok) return made;
      created.push(made.value);
    }
    const saved = await this.plans.createMany(created);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.copied", entityType: "project", entityId: input.targetProjectId, projectId: input.targetProjectId,
      newValue: JSON.stringify({ sourceProjectId: input.sourceProjectId, plannedActivities: created.length, skipped: plan.skipped.length }),
    });
    return ok({ plannedActivities: created.length, skipped: plan.skipped });
  }
}
