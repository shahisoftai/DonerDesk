import { DomainError, err, evidenceCoverage, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";

export interface FileNeedsDto {
  /** The kinds of file the planned activity this one delivers asks for (none when it is not linked to a plan). */
  required: string[];
  provided: string[];
  /** Asked for and not attached to this completed activity. It never blocks accepting it. */
  stillNeeded: string[];
}

/** For one completed activity: which of its planned activity's "files we will need" are not attached yet. */
export class GetActivityFileNeedsHandler {
  constructor(private readonly activities: IActivityUpdateRepository, private readonly plans: IPlannedActivityRepository, private readonly evidence: IEvidenceRepository) {}

  async handle(ctx: AuthenticatedContext, activityId: string): Promise<Result<FileNeedsDto, DomainError>> {
    const a = await this.activities.findById(activityId, ctx.tenant.tenantId);
    if (!a.ok) return a;
    if (!a.value) return err(DomainError.notFound("ActivityUpdate", activityId));
    const none: FileNeedsDto = { required: [], provided: [], stillNeeded: [] };
    if (!a.value.plannedActivityId) return ok(none);
    const plan = await this.plans.findById(a.value.plannedActivityId, ctx.tenant.tenantId);
    if (!plan.ok) return plan;
    if (!plan.value || plan.value.requiredFiles.length === 0) return ok(none);
    const types = new Set<string>();
    for (const id of a.value.attachedEvidenceIds) {
      const file = await this.evidence.findById(id, ctx.tenant.tenantId);
      if (!file.ok) return file;
      if (file.value) types.add(file.value.evidenceType);
    }
    const cover = evidenceCoverage(plan.value.requiredFiles, types);
    return ok({ required: cover.required, provided: [...types], stillNeeded: cover.stillNeeded });
  }
}
