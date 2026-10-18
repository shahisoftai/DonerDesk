import { DomainError, PlannedActivity, checkAssignable, expandRecurrence, proposePlanDates, validateRecurrence, ok, err, type Result, type PlainDate, type RecurrenceRule } from "@donordesk/domain";
import type { StartPlanFromLogframeInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export interface PlanPreviewRow {
  logframeActivityId: string;
  title: string;
  outputId?: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  repeats?: RecurrenceRule;
  ownerUserId?: string;
}
export interface PlanPreview {
  rows: PlanPreviewRow[];
  /** Planned activities that will exist after Create (a repeating row counts every occurrence). */
  total: number;
  repeating: number;
}

/**
 * The wizard's one write: logframe ACTIVITY nodes become planned activities. `apply: false` returns the preview
 * (nothing saved). Refused when the project already has planned activities (then it is "Add activity").
 */
export class StartPlanFromLogframeHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly logframe: ILogframeRepository, private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: StartPlanFromLogframeInput): Promise<Result<{ preview: PlanPreview; createdIds?: string[] }, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId = ctx.tenant.tenantId;
    const existing = await this.repo.findByProject(projectId, tenantId);
    if (!existing.ok) return existing;
    if (existing.value.length > 0) return err(DomainError.conflict("This project already has planned activities: add to the plan instead"));
    const dates = await this.context.projectDates(projectId, tenantId);
    if (!dates.ok) return dates;
    if (!dates.value) return err(DomainError.notFound("Project", projectId));
    const items = await this.logframe.findByProject(projectId, tenantId);
    if (!items.ok) return items;
    const nodes = items.value.filter((i) => i.level === "ACTIVITY");
    const wanted = input.rows ?? nodes.map((n) => ({ logframeActivityId: n.id, monthly: false } as NonNullable<StartPlanFromLogframeInput["rows"]>[number]));
    if (wanted.length === 0) return err(DomainError.validation("This logframe has no activities to plan yet"));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const w of wanted) if (!byId.has(w.logframeActivityId)) return err(DomainError.validation("Choose activities from this project's logframe", { field: "logframeActivityId" }));

    const proposals = proposePlanDates(wanted.map((w) => ({ nodeId: w.logframeActivityId, monthly: w.monthly })), dates.value);
    const members = await this.context.activeMemberIds(projectId, tenantId);
    if (!members.ok) return members;
    const rows: PlanPreviewRow[] = [];
    wanted.forEach((w, i) => {
      const p = proposals[i]!;
      const node = byId.get(w.logframeActivityId)!;
      rows.push({
        logframeActivityId: node.id, title: node.title, ...(node.parentId ? { outputId: node.parentId } : {}),
        plannedStart: w.plannedStart ?? p.start, plannedEnd: w.plannedEnd ?? (w.plannedStart ? w.plannedStart : p.end),
        ...(w.monthly && p.repeats ? { repeats: p.repeats } : {}), ...(w.ownerUserId ? { ownerUserId: w.ownerUserId } : {}),
      });
    });

    const planned: PlannedActivity[] = [];
    for (const row of rows) {
      const people = checkAssignable({ ownerUserId: row.ownerUserId }, members.value);
      if (!people.ok) return people;
      const seriesId = row.repeats ? this.ids.generate() : undefined;
      if (row.repeats) { const v = validateRecurrence(row.repeats, row.plannedStart); if (!v.ok) return v; }
      const occurrences = row.repeats ? expandRecurrence(row.repeats, { start: row.plannedStart, end: row.plannedEnd }).occurrences : [{ start: row.plannedStart, end: row.plannedEnd }];
      for (const o of occurrences) {
        const created = PlannedActivity.create({
          id: this.ids.generate(), tenantId: tenantId.toString(), projectId, title: row.title, plannedStart: o.start, plannedEnd: o.end,
          logframeActivityId: row.logframeActivityId, ...(row.outputId ? { outputId: row.outputId } : {}), people: people.value, createdById: ctx.tenant.userId,
          ...(seriesId ? { seriesId } : {}), ...(row.repeats ? { recurrence: row.repeats } : {}),
        });
        if (!created.ok) return created;
        planned.push(created.value);
      }
    }
    const preview: PlanPreview = { rows, total: planned.length, repeating: rows.filter((r) => r.repeats).length };
    if (!input.apply) return ok({ preview });

    const saved = await this.repo.createMany(planned);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.started_from_logframe", entityType: "project", entityId: projectId, projectId,
      systemNote: `${planned.length} planned activities, ${preview.repeating} repeating monthly`,
    });
    return ok({ preview, createdIds: planned.map((p) => p.id) });
  }
}
