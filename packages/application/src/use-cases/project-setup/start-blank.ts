import type { Result, Role } from "@donordesk/domain";
import { DomainError, Permissions, emptyExtras, emptyProposal } from "@donordesk/domain";
import type { StartBlankSetupInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ISetupProposalRepository } from "../../ports/project-setup.js";
import { proposalExpiry } from "./proposal-state.js";

/**
 * Starts the Project Creation Wizard with no documents (Phase 38). Needs no AI service and no Drive: the draft starts empty
 * and READY, and the person fills it slide by slide. A project started from documents uses `StartSetupExtractionHandler`;
 * both make the same kind of draft.
 */
export class StartBlankSetupHandler {
  constructor(
    private readonly proposals: ISetupProposalRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async handle(ctx: AuthenticatedContext, input: StartBlankSetupInput): Promise<Result<{ proposalId: string }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.create")) {
      return { ok: false, error: DomainError.forbidden("You cannot create projects") };
    }
    const now = this.clock.now();
    const id = this.ids.generate();
    const extras = emptyExtras(false);
    extras.start = { ...extras.start, ...(input.donor ? { donor: input.donor } : {}), ...(input.sector ? { sector: input.sector } : {}), ...(input.country ? { country: input.country } : {}) };
    const created = await this.proposals.create({
      id, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId, status: "READY",
      sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0,
      proposal: emptyProposal(), extras, problems: [], createdAt: now, updatedAt: now, expiresAt: proposalExpiry(now),
    });
    if (!created.ok) return created;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.blank.started",
      entityType: "project_setup_proposal", entityId: id,
    });
    return { ok: true, value: { proposalId: id } };
  }
}
