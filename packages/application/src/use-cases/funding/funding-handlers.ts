import type { Result, Role, FundedProject, FundingTotals, GrantRecord, ProgrammeRecord } from "@donordesk/domain";
import { DomainError, Permissions, cleanGrant, cleanProgramme, summarizeFunding, type GrantInput, type ProgrammeInput } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IFundingRepository, IProjectRepository } from "../../ports/projects.js";
import type { VisibleProjects } from "../../services/visible-projects.js";

export interface FundingView {
  programmes: Array<ProgrammeRecord & { grants: GrantRecord[]; projects: FundedProject[]; totals: FundingTotals }>;
  /** Grants that belong to no programme. */
  looseGrants: Array<GrantRecord & { projects: FundedProject[]; totals: FundingTotals }>;
  /** Projects under no grant and no programme. */
  unplacedProjects: FundedProject[];
}

const need = (ctx: AuthenticatedContext) => Permissions.require(ctx.tenant.role as Role, "project.create");

/** Programmes with their grants and the projects a person may see under them, with totals. */
export class ListFundingHandler {
  constructor(private readonly funding: IFundingRepository, private readonly visible: VisibleProjects) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<FundingView, DomainError>> {
    const [programmes, grants, placements, projects] = await Promise.all([
      this.funding.listProgrammes(ctx.tenant.tenantId),
      this.funding.listGrants(ctx.tenant.tenantId),
      this.funding.projectPlacements(ctx.tenant.tenantId),
      this.visible.for(ctx),
    ]);
    if (!programmes.ok) return programmes;
    if (!grants.ok) return grants;
    if (!placements.ok) return placements;
    if (!projects.ok) return projects;
    const funded: FundedProject[] = projects.value.map((p) => ({
      id: p.id, title: p.title, status: p.status,
      programmeId: placements.value.get(p.id)?.programmeId ?? null,
      grantId: placements.value.get(p.id)?.grantId ?? null,
      ...(p.budget ? { budget: { amount: p.budget.amount, currency: p.budget.currency } } : {}),
    }));
    const inGrant = (grantId: string) => funded.filter((p) => p.grantId === grantId);
    const view: FundingView = {
      programmes: programmes.value.map((programme) => {
        const programmeGrants = grants.value.filter((g) => g.programmeId === programme.id);
        const programmeProjects = funded.filter((p) => p.programmeId === programme.id);
        return { ...programme, grants: programmeGrants, projects: programmeProjects, totals: summarizeFunding(programmeProjects, programmeGrants) };
      }),
      looseGrants: grants.value
        .filter((g) => !g.programmeId)
        .map((g) => ({ ...g, projects: inGrant(g.id), totals: summarizeFunding(inGrant(g.id), [g]) })),
      unplacedProjects: funded.filter((p) => !p.programmeId && !p.grantId),
    };
    return { ok: true, value: view };
  }
}

export class SaveProgrammeHandler {
  constructor(private readonly funding: IFundingRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: ProgrammeInput & { id?: string }): Promise<Result<{ id: string }, DomainError>> {
    need(ctx);
    let clean;
    try { clean = cleanProgramme(input); } catch (error) { if (error instanceof DomainError) return { ok: false, error }; throw error; }
    const existing = await this.funding.listProgrammes(ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    if (existing.value.some((p) => p.id !== input.id && p.name.toLowerCase() === clean.name.toLowerCase())) {
      return { ok: false, error: DomainError.conflict(`There is already a programme called "${clean.name}".`) };
    }
    if (input.id) {
      const found = await this.funding.findProgramme(input.id, ctx.tenant.tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("Programme", input.id) };
      const updated = await this.funding.updateProgramme(input.id, ctx.tenant.tenantId, clean);
      if (!updated.ok) return updated;
      await this.record(ctx, "programme.updated", input.id, clean.name);
      return { ok: true, value: { id: input.id } };
    }
    const id = this.ids.generate();
    const created = await this.funding.createProgramme({ id, tenantId: ctx.tenant.tenantId.toString(), ...clean, createdById: ctx.tenant.userId, createdAt: new Date() });
    if (!created.ok) return created;
    await this.record(ctx, "programme.created", id, clean.name);
    return { ok: true, value: { id } };
  }

  private async record(ctx: AuthenticatedContext, eventType: string, id: string, name: string) {
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType, entityType: "programme", entityId: id, newValue: name });
  }
}

export class SaveGrantHandler {
  constructor(private readonly funding: IFundingRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: GrantInput & { id?: string }): Promise<Result<{ id: string }, DomainError>> {
    need(ctx);
    let clean;
    try { clean = cleanGrant(input); } catch (error) { if (error instanceof DomainError) return { ok: false, error }; throw error; }
    if (clean.programmeId) {
      const programme = await this.funding.findProgramme(clean.programmeId, ctx.tenant.tenantId);
      if (!programme.ok) return programme;
      if (!programme.value) return { ok: false, error: DomainError.notFound("Programme", clean.programmeId) };
    }
    if (input.id) {
      const found = await this.funding.findGrant(input.id, ctx.tenant.tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("Grant", input.id) };
      const updated = await this.funding.updateGrant(input.id, ctx.tenant.tenantId, clean);
      if (!updated.ok) return updated;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "grant.updated", entityType: "grant", entityId: input.id, newValue: clean.title });
      return { ok: true, value: { id: input.id } };
    }
    const id = this.ids.generate();
    const created = await this.funding.createGrant({ id, tenantId: ctx.tenant.tenantId.toString(), ...clean, createdById: ctx.tenant.userId, createdAt: new Date() });
    if (!created.ok) return created;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "grant.created", entityType: "grant", entityId: id, newValue: clean.title });
    return { ok: true, value: { id } };
  }
}

/** Puts a project under a grant and/or programme. A grant that belongs to a programme brings the programme with it; `null` takes the project out. */
export class PlaceProjectHandler {
  constructor(private readonly funding: IFundingRepository, private readonly projects: IProjectRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { programmeId?: string | null; grantId?: string | null }): Promise<Result<{ programmeId: string | null; grantId: string | null }, DomainError>> {
    need(ctx);
    const project = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    let programmeId = input.programmeId ?? null;
    const grantId = input.grantId ?? null;
    if (grantId) {
      const grant = await this.funding.findGrant(grantId, ctx.tenant.tenantId);
      if (!grant.ok) return grant;
      if (!grant.value) return { ok: false, error: DomainError.notFound("Grant", grantId) };
      if (grant.value.programmeId) {
        if (programmeId && programmeId !== grant.value.programmeId) return { ok: false, error: DomainError.validation("That grant belongs to a different programme.") };
        programmeId = grant.value.programmeId;
      }
    }
    if (programmeId) {
      const programme = await this.funding.findProgramme(programmeId, ctx.tenant.tenantId);
      if (!programme.ok) return programme;
      if (!programme.value) return { ok: false, error: DomainError.notFound("Programme", programmeId) };
    }
    const placed = await this.funding.placeProject(projectId, ctx.tenant.tenantId, { programmeId, grantId });
    if (!placed.ok) return placed;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.funding.placed", entityType: "project", entityId: projectId, projectId, newValue: JSON.stringify({ programmeId, grantId }) });
    return { ok: true, value: { programmeId, grantId } };
  }
}
