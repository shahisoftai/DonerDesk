import {
  DomainError, PlannedActivity, addDays, daysBetween, checkAssignable, expandRecurrence, validateRecurrence, toPlainDate, ok, err, cascadeAfterMove,
  type PlanAction, type Result, type PlainDate,
} from "@donordesk/domain";
import type { AssignPlannedActivityInput, ChangePlanStatusInput, CreatePlannedActivityInput, ReschedulePlannedActivityInput, UpdatePlannedActivityInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IPlanContextReader, IPlanDependencyRepository, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";
import { toDependencyItem, toDependencyLink } from "./plan-dependency-handlers.js";
import type { PlanRecorder } from "../../services/plan-recorder.js";

const today = (clock: IClock): PlainDate => toPlainDate(clock.now())!;

export class CreatePlannedActivityHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly logframe: ILogframeRepository, private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: CreatePlannedActivityInput): Promise<Result<{ ids: string[]; capped: boolean }, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId = ctx.tenant.tenantId;
    const members = await this.context.activeMemberIds(projectId, tenantId);
    if (!members.ok) return members;
    const people = checkAssignable({ ownerUserId: input.ownerUserId, supportUserIds: input.supportUserIds }, members.value);
    if (!people.ok) return people;

    let outputId: string | undefined;
    if (input.logframeActivityId) {
      const items = await this.logframe.findByProject(projectId, tenantId);
      if (!items.ok) return items;
      const node = items.value.find((i) => i.id === input.logframeActivityId);
      if (!node || node.level !== "ACTIVITY") return err(DomainError.validation("Choose an activity from this project's logframe", { field: "logframeActivityId" }));
      outputId = node.parentId ?? undefined;
    }

    let dates = [{ start: input.plannedStart, end: input.plannedEnd }];
    let capped = false;
    const seriesId = input.repeats ? this.ids.generate() : undefined;
    const recurrence = input.repeats ? { every: input.repeats.every, interval: 1, until: input.repeats.until } : undefined;
    if (recurrence) {
      const valid = validateRecurrence(recurrence, input.plannedStart);
      if (!valid.ok) return valid;
      const expanded = expandRecurrence(recurrence, { start: input.plannedStart, end: input.plannedEnd });
      dates = expanded.occurrences.map((o) => ({ start: o.start, end: o.end }));
      capped = expanded.capped;
    }

    const items: PlannedActivity[] = [];
    for (const d of dates) {
      const created = PlannedActivity.create({
        id: this.ids.generate(), tenantId: tenantId.toString(), projectId, title: input.title, plannedStart: d.start, plannedEnd: d.end,
        people: people.value, createdById: ctx.tenant.userId,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.requiredFiles ? { requiredFiles: input.requiredFiles } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.logframeActivityId ? { logframeActivityId: input.logframeActivityId } : {}),
        ...(outputId ? { outputId } : {}),
        ...(input.targetParticipants !== undefined ? { targetParticipants: input.targetParticipants } : {}),
        ...(input.targetCount !== undefined ? { targetCount: input.targetCount } : {}),
        ...(seriesId ? { seriesId } : {}), ...(recurrence ? { recurrence } : {}),
      });
      if (!created.ok) return created;
      items.push(created.value);
    }
    const saved = await this.repo.createMany(items);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.item_created", entityType: "planned_activity", entityId: items[0]!.id, projectId,
      systemNote: `${items.length} planned ${items.length === 1 ? "activity" : "activities"} created`,
    });
    return ok({ ids: items.map((i) => i.id), capped });
  }
}

export class ChangePlanStatusHandler {
  constructor(private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly recorder: PlanRecorder, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: ChangePlanStatusInput): Promise<Result<void, DomainError>> {
    const loaded = await this.access.load(ctx, itemId, input.action === "CANCEL" ? "CANCEL" : "CHANGE_STATUS");
    if (!loaded.ok) return loaded;
    const item = loaded.value;
    const changed = item.applyStatus(input.action as PlanAction, { at: this.clock.now(), ...(input.reason ? { reason: input.reason } : {}) });
    if (!changed.ok) return changed;
    const saved = await this.repo.update(item);
    if (!saved.ok) return saved;
    return this.recorder.record(ctx, item, changed.value, "workplan.status_changed");
  }
}

export interface RescheduleOutcome {
  moved: number;
  /** Activities pushed because an activity they wait for moved (phase 28.1-A). */
  movedByDependency: Array<{ id: string; title: string; plannedStart: PlainDate; plannedEnd: PlainDate }>;
  /** Activities that should have moved but are done or cancelled; the conflict is shown, not hidden. */
  blockedByDependency: Array<{ id: string; title: string; reason: "DONE" | "CANCELLED" }>;
}

export class ReschedulePlannedActivityHandler {
  constructor(
    private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly recorder: PlanRecorder, private readonly clock: IClock,
    private readonly dependencies?: IPlanDependencyRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: ReschedulePlannedActivityInput): Promise<Result<RescheduleOutcome, DomainError>> {
    const loaded = await this.access.load(ctx, itemId, "MOVE");
    if (!loaded.ok) return loaded;
    const first = loaded.value;
    let targets = [first];
    if (input.scope === "SERIES_FROM_HERE" && first.seriesId) {
      const series = await this.repo.findBySeries(first.seriesId, ctx.tenant.tenantId);
      if (!series.ok) return series;
      targets = series.value.filter((i) => i.plannedStart >= first.plannedStart && (i.status === "PLANNED" || i.status === "IN_PROGRESS"));
    }
    // Later occurrences keep their distance from the one the person moved.
    const offset = daysBetween(first.plannedStart, input.plannedStart);
    const length = daysBetween(input.plannedStart, input.plannedEnd);
    for (const item of targets) {
      const start = item.id === first.id ? input.plannedStart : addDays(item.plannedStart, offset);
      const end = item.id === first.id ? input.plannedEnd : addDays(start, length);
      const used = await this.context.reportUsesDates(item.projectId, ctx.tenant.tenantId, { start: item.plannedStart, end: item.plannedEnd });
      if (!used.ok) return used;
      const moved = item.reschedule({ start, end }, { today: today(this.clock), reportUsesIt: used.value, ...(input.reason ? { reason: input.reason } : {}) });
      if (!moved.ok) return moved;
      const saved = await this.repo.update(item);
      if (!saved.ok) return saved;
      const recorded = await this.recorder.record(ctx, item, moved.value, "workplan.item_rescheduled");
      if (!recorded.ok) return recorded;
    }
    const cascade = await this.followDependencies(ctx, targets, input.reason);
    if (!cascade.ok) return cascade;
    return ok({ moved: targets.length, movedByDependency: cascade.value.moved, blockedByDependency: cascade.value.blocked });
  }

  /** Pushes activities that wait for a moved one (finish-to-start), recording each move with its cause. */
  private async followDependencies(
    ctx: AuthenticatedContext, roots: PlannedActivity[], reason: string | undefined,
  ): Promise<Result<{ moved: RescheduleOutcome["movedByDependency"]; blocked: RescheduleOutcome["blockedByDependency"] }, DomainError>> {
    const empty = { moved: [], blocked: [] };
    if (!this.dependencies || roots.length === 0) return ok(empty);
    const tenantId = ctx.tenant.tenantId;
    const projectId = roots[0]!.projectId;
    const links = await this.dependencies.findByProject(projectId, tenantId);
    if (!links.ok) return links;
    if (links.value.length === 0) return ok(empty);
    const all = await this.repo.findByProject(projectId, tenantId);
    if (!all.ok) return all;
    const byId = new Map(all.value.map((i) => [i.id, i]));
    let items = all.value.map(toDependencyItem);
    const linkList = links.value.map(toDependencyLink);
    const moved: RescheduleOutcome["movedByDependency"] = [];
    const blocked: RescheduleOutcome["blockedByDependency"] = [];

    for (const root of roots) {
      const cascade = cascadeAfterMove(items, linkList, root.id);
      for (const move of cascade.moves) {
        const item = byId.get(move.id);
        if (!item) continue;
        const cause = byId.get(move.causedBy)?.title ?? "an earlier activity";
        const used = await this.context.reportUsesDates(projectId, tenantId, { start: item.plannedStart, end: item.plannedEnd });
        if (!used.ok) return used;
        const change = item.reschedule({ start: move.plannedStart, end: move.plannedEnd }, {
          today: today(this.clock), reportUsesIt: used.value, reason: reason?.trim() || `Moved to follow "${cause}"`,
        });
        if (!change.ok) return change;
        const saved = await this.repo.update(item);
        if (!saved.ok) return saved;
        const recorded = await this.recorder.record(ctx, item, change.value, "workplan.item_moved_by_dependency");
        if (!recorded.ok) return recorded;
        moved.push({ id: item.id, title: item.title, plannedStart: move.plannedStart, plannedEnd: move.plannedEnd });
        items = items.map((i) => (i.id === move.id ? { ...i, plannedStart: move.plannedStart, plannedEnd: move.plannedEnd } : i));
      }
      for (const b of cascade.blocked) blocked.push({ id: b.id, title: byId.get(b.id)?.title ?? "", reason: b.reason });
    }
    return ok({ moved, blocked });
  }
}

export class AssignPlannedActivityHandler {
  constructor(private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader, private readonly recorder: PlanRecorder) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: AssignPlannedActivityInput): Promise<Result<void, DomainError>> {
    const loaded = await this.access.load(ctx, itemId, "ASSIGN");
    if (!loaded.ok) return loaded;
    const item = loaded.value;
    const members = await this.context.activeMemberIds(item.projectId, ctx.tenant.tenantId);
    if (!members.ok) return members;
    const people = checkAssignable({ ownerUserId: input.ownerUserId ?? undefined, supportUserIds: input.supportUserIds }, members.value);
    if (!people.ok) return people;
    const changed = item.assign(people.value, { ...(input.reason ? { reason: input.reason } : {}) });
    if (!changed.ok) return changed;
    if (Object.keys(changed.value.change).length === 0) return ok(undefined);
    const saved = await this.repo.update(item);
    if (!saved.ok) return saved;
    return this.recorder.record(ctx, item, changed.value, "workplan.item_assigned");
  }
}

export class UpdatePlannedActivityHandler {
  constructor(
    private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly recorder: PlanRecorder, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: UpdatePlannedActivityInput): Promise<Result<void, DomainError>> {
    const { reason, requiredFiles, ...fields } = input;
    const onlyNotes = requiredFiles === undefined && Object.keys(fields).every((k) => k === "description" || k === "location");
    const loaded = await this.access.load(ctx, itemId, onlyNotes ? "EDIT_NOTES" : "EDIT");
    if (!loaded.ok) return loaded;
    const item = loaded.value;
    const used = await this.context.reportUsesDates(item.projectId, ctx.tenant.tenantId, { start: item.plannedStart, end: item.plannedEnd });
    if (!used.ok) return used;
    const patch = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === null ? undefined : v]));
    const changed = item.updateDetails(patch, { today: today(this.clock), reportUsesIt: used.value, ...(reason ? { reason } : {}) });
    if (!changed.ok) return changed;
    // Files we will need are part of the same edit and the same history entry.
    const files = requiredFiles === undefined ? ok({ change: {} }) : item.setRequiredFiles(requiredFiles);
    if (!files.ok) return files;
    const change = { ...changed.value.change, ...files.value.change };
    if (Object.keys(change).length === 0) return ok(undefined);
    const saved = await this.repo.update(item);
    if (!saved.ok) return saved;
    return this.recorder.record(ctx, item, { change, ...(changed.value.reason ? { reason: changed.value.reason } : {}) }, "workplan.item_updated");
  }
}
