import type { Result } from "@donordesk/domain";
import { DomainError, planLogframeCopy, logframeLevelRank } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

export interface CopyProjectSetupInput {
  targetProjectId: string;
  sourceProjectId: string;
}

export interface CopyProjectSetupResult {
  items: number;
  indicators: number;
}

/**
 * Starts a project's logframe and indicators from another project of the same workspace, so a second, similar grant does
 * not mean rebuilding the results framework. Only definitions are copied (see `planLogframeCopy`); it refuses to run into a
 * project that already has a logframe, so nothing is duplicated or merged.
 */
export class CopyProjectSetupHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext, input: CopyProjectSetupInput): Promise<Result<CopyProjectSetupResult, DomainError>> {
    if (input.sourceProjectId === input.targetProjectId) {
      return { ok: false, error: DomainError.validation("Choose a different project to copy from.") };
    }
    const tenantId = ctx.tenant.tenantId;
    for (const id of [input.targetProjectId, input.sourceProjectId]) {
      const found = await this.projects.findById(id, tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("Project", id) };
    }

    const existing = await this.logframe.findByProject(input.targetProjectId, tenantId);
    if (!existing.ok) return existing;
    if (existing.value.length > 0) {
      return { ok: false, error: DomainError.validation("This project already has a logframe. Copying is only offered into an empty one.") };
    }

    const sourceItems = await this.logframe.findByProject(input.sourceProjectId, tenantId);
    if (!sourceItems.ok) return sourceItems;
    if (sourceItems.value.length === 0) {
      return { ok: false, error: DomainError.validation("The project you chose has no logframe to copy.") };
    }
    const sourceIndicators = await this.indicators.findByProject(input.sourceProjectId, tenantId, { includeArchived: true });
    if (!sourceIndicators.ok) return sourceIndicators;

    const plan = planLogframeCopy({
      items: sourceItems.value,
      indicators: sourceIndicators.value,
      tenantId: tenantId.toString(),
      targetProjectId: input.targetProjectId,
      newId: () => this.ids.generate(),
      now: this.now(),
    });

    // Parents first, so a store that checks the parent reference never sees a child before its parent.
    for (const item of [...plan.items].sort((a, b) => logframeLevelRank(a.level) - logframeLevelRank(b.level))) {
      const saved = await this.logframe.create(item);
      if (!saved.ok) return saved;
    }
    for (const indicator of plan.indicators) {
      const saved = await this.indicators.create(indicator);
      if (!saved.ok) return saved;
    }

    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.setup.copied",
      entityType: "project",
      entityId: input.targetProjectId,
      projectId: input.targetProjectId,
      newValue: JSON.stringify({ sourceProjectId: input.sourceProjectId, items: plan.items.length, indicators: plan.indicators.length }),
    });
    return { ok: true, value: { items: plan.items.length, indicators: plan.indicators.length } };
  }
}
