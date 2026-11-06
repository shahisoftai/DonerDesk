import { DomainError, adaptationProblem, type AdaptationRecord, type Result } from "@donordesk/domain";
import type { RecordAdaptationInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IAdaptationRepository } from "../../ports/adaptations.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";

type Links = Pick<RecordAdaptationInput, "plannedActivityId" | "indicatorId" | "reportingPeriodId">;

/** The activity, indicator or report an adaptation points at must belong to the same project; nothing else is checked. */
async function checkLinks(
  deps: { planned: IPlannedActivityRepository; indicators: IIndicatorRepository; periods: IReportingPeriodRepository },
  ctx: AuthenticatedContext, projectId: string, links: Links,
): Promise<Result<void, DomainError>> {
  const tenantId = ctx.tenant.tenantId;
  const wrong = (what: string): Result<void, DomainError> => ({ ok: false, error: DomainError.validation(`That ${what} is not part of this project.`) });
  if (links.plannedActivityId) {
    const r = await deps.planned.findById(links.plannedActivityId, tenantId);
    if (!r.ok) return r;
    if (!r.value || r.value.projectId !== projectId) return wrong("planned activity");
  }
  if (links.indicatorId) {
    const r = await deps.indicators.findById(links.indicatorId, tenantId);
    if (!r.ok) return r;
    if (!r.value || r.value.projectId !== projectId) return wrong("indicator");
  }
  if (links.reportingPeriodId) {
    const r = await deps.periods.findById(links.reportingPeriodId, tenantId);
    if (!r.ok) return r;
    if (!r.value || r.value.projectId !== projectId) return wrong("report");
  }
  return { ok: true, value: undefined };
}

export class RecordAdaptationHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly repo: IAdaptationRepository, private readonly audit: IAuditLogger,
    private readonly deps: { planned: IPlannedActivityRepository; indicators: IIndicatorRepository; periods: IReportingPeriodRepository },
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: RecordAdaptationInput): Promise<Result<{ id: string }, DomainError>> {
    const problem = adaptationProblem(input);
    if (problem) return { ok: false, error: DomainError.validation(problem) };
    const links = await checkLinks(this.deps, ctx, projectId, input);
    if (!links.ok) return links;
    const record: AdaptationRecord = {
      id: this.ids.generate(), projectId, recordedOn: input.recordedOn, whatChanged: input.whatChanged.trim(), why: input.why.trim(),
      ...(input.effectOnResults?.trim() ? { effectOnResults: input.effectOnResults.trim() } : {}),
      ...(input.plannedActivityId ? { plannedActivityId: input.plannedActivityId } : {}),
      ...(input.indicatorId ? { indicatorId: input.indicatorId } : {}),
      ...(input.reportingPeriodId ? { reportingPeriodId: input.reportingPeriodId } : {}),
      recordedById: ctx.tenant.userId,
    };
    const saved = await this.repo.create(record, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.adaptation.recorded", entityType: "project_adaptation", entityId: record.id, projectId, newValue: record.whatChanged });
    return { ok: true, value: { id: record.id } };
  }
}

/** Corrects an adaptation; only what is sent changes, and an empty effect or link clears it. */
export class UpdateAdaptationHandler {
  constructor(
    private readonly repo: IAdaptationRepository, private readonly audit: IAuditLogger,
    private readonly deps: { planned: IPlannedActivityRepository; indicators: IIndicatorRepository; periods: IReportingPeriodRepository },
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, patch: Partial<RecordAdaptationInput>): Promise<Result<void, DomainError>> {
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Adaptation", id) };
    const before = found.value;
    const clean = (v: string | undefined): string | undefined => (v === undefined ? undefined : v.trim() === "" ? undefined : v.trim());
    const next: AdaptationRecord = {
      ...before,
      recordedOn: patch.recordedOn ?? before.recordedOn,
      whatChanged: patch.whatChanged !== undefined ? patch.whatChanged.trim() : before.whatChanged,
      why: patch.why !== undefined ? patch.why.trim() : before.why,
      effectOnResults: patch.effectOnResults !== undefined ? clean(patch.effectOnResults) : before.effectOnResults,
      plannedActivityId: "plannedActivityId" in patch ? clean(patch.plannedActivityId) : before.plannedActivityId,
      indicatorId: "indicatorId" in patch ? clean(patch.indicatorId) : before.indicatorId,
      reportingPeriodId: "reportingPeriodId" in patch ? clean(patch.reportingPeriodId) : before.reportingPeriodId,
    };
    const problem = adaptationProblem(next);
    if (problem) return { ok: false, error: DomainError.validation(problem) };
    const links = await checkLinks(this.deps, ctx, before.projectId, next);
    if (!links.ok) return links;
    const saved = await this.repo.update(next, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.adaptation.updated", entityType: "project_adaptation", entityId: id, projectId: before.projectId,
      oldValue: JSON.stringify({ whatChanged: before.whatChanged, why: before.why, effectOnResults: before.effectOnResults }), newValue: JSON.stringify({ whatChanged: next.whatChanged, why: next.why, effectOnResults: next.effectOnResults }),
    });
    return { ok: true, value: undefined };
  }
}

export class ListAdaptationsHandler {
  constructor(private readonly repo: IAdaptationRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<AdaptationRecord[], DomainError>> {
    return this.repo.findByProject(projectId, ctx.tenant.tenantId);
  }
}
