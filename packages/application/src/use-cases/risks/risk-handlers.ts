import { DomainError, Permissions, ProjectRisk, canActOnRisk, err, ok, toPlainDate, type PlainDate, type Result, type Role } from "@donordesk/domain";
import type { CloseRiskInput, CreateRiskInput, UpdateRiskInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type { IProjectRiskRepository } from "../../ports/risks.js";
import type { IProjectRoster } from "../../ports/tasks.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";

const isManager = (ctx: AuthenticatedContext) => Permissions.can(ctx.tenant.role as Role, "risk.manage");
const today = (clock: IClock): PlainDate => toPlainDate(clock.now())!;

export interface RiskDto {
  id: string;
  kind: string;
  title: string;
  seriousness: string;
  ownerId?: string;
  action: string;
  status: string;
  closedNote?: string;
  plannedActivityId?: string;
  raisedById: string;
  reviewBy?: string;
  /** Whether the caller may change or close it (the screen shows the buttons only then). */
  canChange: boolean;
}

const SERIOUS_FIRST = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

function toDto(r: ProjectRisk, ctx: AuthenticatedContext): RiskDto {
  const s = r.snapshot();
  return {
    id: r.id, kind: s.kind, title: s.title, seriousness: s.seriousness, ...(s.ownerId ? { ownerId: s.ownerId } : {}), action: s.action, status: s.status,
    ...(s.closedNote ? { closedNote: s.closedNote } : {}), ...(s.plannedActivityId ? { plannedActivityId: s.plannedActivityId } : {}), raisedById: s.raisedById,
    ...(s.reviewBy ? { reviewBy: s.reviewBy } : {}),
    canChange: r.isOpen && canActOnRisk(ctx.tenant.userId, { ownerId: s.ownerId, raisedById: s.raisedById }, isManager(ctx)),
  };
}

async function checkHandler(roster: IProjectRoster, ctx: AuthenticatedContext, projectId: string, ownerId: string | undefined | null): Promise<Result<void, DomainError>> {
  if (!ownerId) return ok(undefined);
  const members = await roster.activeMembers(projectId, ctx.tenant.tenantId);
  if (!members.ok) return members;
  return members.value.some((m) => m.userId === ownerId) ? ok(undefined) : err(DomainError.validation("Only an active member of this project can handle this", { field: "ownerId" }));
}

/** Anyone but a viewer raises one. The person chosen to handle it is told. It is audited and never reaches a report. */
export class CreateRiskHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly repo: IProjectRiskRepository, private readonly roster: IProjectRoster, private readonly plans: IPlannedActivityRepository,
    private readonly notifier: IPersonNotifier, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: CreateRiskInput): Promise<Result<{ id: string }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "risk.raise")) return err(DomainError.forbidden("You cannot raise a problem"));
    const owner = await checkHandler(this.roster, ctx, projectId, input.ownerId);
    if (!owner.ok) return owner;
    if (input.plannedActivityId) {
      const plan = await this.plans.findById(input.plannedActivityId, ctx.tenant.tenantId);
      if (!plan.ok) return plan;
      if (!plan.value || plan.value.projectId !== projectId) return err(DomainError.validation("Choose a planned activity of this project", { field: "plannedActivityId" }));
    }
    const created = ProjectRisk.create({
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId, kind: input.kind, title: input.title, seriousness: input.seriousness,
      ownerId: input.ownerId, action: input.action, raisedById: ctx.tenant.userId, today: today(this.clock), ...(input.plannedActivityId ? { plannedActivityId: input.plannedActivityId } : {}),
    });
    if (!created.ok) return created;
    const saved = await this.repo.create(created.value);
    if (!saved.ok) return saved;
    if (input.ownerId && input.ownerId !== ctx.tenant.userId) {
      await this.notifier.send({ tenantId: ctx.tenant.tenantId, recipientId: input.ownerId, type: "ASSIGNMENT", urgent: input.seriousness === "HIGH", title: input.seriousness === "HIGH" ? "A serious problem is yours to handle" : "A problem is yours to handle", message: input.title, relatedEntityType: "project_risk", relatedEntityId: created.value.id });
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "risk.created", entityType: "project_risk", entityId: created.value.id, projectId, newValue: JSON.stringify({ kind: input.kind, seriousness: input.seriousness, ownerId: input.ownerId ?? null }) });
    return ok({ id: created.value.id });
  }
}

async function load(repo: IProjectRiskRepository, ctx: AuthenticatedContext, id: string): Promise<Result<ProjectRisk, DomainError>> {
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value) return err(DomainError.notFound("Problem", id));
  const s = found.value.snapshot();
  return canActOnRisk(ctx.tenant.userId, { ownerId: s.ownerId, raisedById: s.raisedById }, isManager(ctx)) ? ok(found.value) : err(DomainError.forbidden("Only the person handling this, the person who raised it, or a manager can change it"));
}

export class UpdateRiskHandler {
  constructor(private readonly repo: IProjectRiskRepository, private readonly roster: IProjectRoster, private readonly notifier: IPersonNotifier, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, riskId: string, input: UpdateRiskInput): Promise<Result<void, DomainError>> {
    const loaded = await load(this.repo, ctx, riskId);
    if (!loaded.ok) return loaded;
    const risk = loaded.value;
    const owner = await checkHandler(this.roster, ctx, risk.projectId, input.ownerId);
    if (!owner.ok) return owner;
    const before = risk.ownerId;
    const out = risk.update({
      ...(input.kind !== undefined ? { kind: input.kind } : {}), ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.seriousness !== undefined ? { seriousness: input.seriousness } : {}), ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId ?? undefined } : {}),
    }, today(this.clock));
    if (!out.ok) return out;
    if (out.value.changed.length === 0) return ok(undefined);
    const saved = await this.repo.update(risk);
    if (!saved.ok) return saved;
    if (risk.ownerId && risk.ownerId !== before && risk.ownerId !== ctx.tenant.userId) {
      await this.notifier.send({ tenantId: ctx.tenant.tenantId, recipientId: risk.ownerId, type: "ASSIGNMENT", urgent: risk.seriousness === "HIGH", title: "A problem is yours to handle", message: risk.title, relatedEntityType: "project_risk", relatedEntityId: risk.id });
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "risk.updated", entityType: "project_risk", entityId: risk.id, projectId: risk.projectId, newValue: JSON.stringify(out.value.changed) });
    return ok(undefined);
  }
}

export class CloseRiskHandler {
  constructor(private readonly repo: IProjectRiskRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, riskId: string, input: CloseRiskInput): Promise<Result<void, DomainError>> {
    const loaded = await load(this.repo, ctx, riskId);
    if (!loaded.ok) return loaded;
    const closed = loaded.value.close(ctx.tenant.userId, input.note, this.clock.now());
    if (!closed.ok) return closed;
    const saved = await this.repo.update(loaded.value);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "risk.closed", entityType: "project_risk", entityId: riskId, projectId: loaded.value.projectId });
    return ok(undefined);
  }
}

/** Open ones first, the most serious at the top; the last 20 closed ones after. `project.view` is enforced by the route table. */
export class ListRisksHandler {
  constructor(private readonly repo: IProjectRiskRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<RiskDto[], DomainError>> {
    const all = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const open = all.value.filter((r) => r.isOpen).sort((a, b) => SERIOUS_FIRST[a.seriousness] - SERIOUS_FIRST[b.seriousness] || b.createdAt.getTime() - a.createdAt.getTime());
    const closed = all.value.filter((r) => !r.isOpen).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 20);
    return ok([...open, ...closed].map((r) => toDto(r, ctx)));
  }
}
