import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceLinker } from "../../ports/evidence-linker.js";

export interface AttachEvidenceInput {
  evidenceId: string;
  activityId?: string;
  /** An indicator-update id (an indicator id is also resolved through the file's reporting period). */
  indicatorId?: string;
}

/** Attaches a file as proof to an activity and/or an indicator update. All linking rules live in `IEvidenceLinker`. */
export class AttachEvidenceHandler {
  constructor(private readonly linker: IEvidenceLinker) {}

  async handle(ctx: AuthenticatedContext, input: AttachEvidenceInput): Promise<Result<void, DomainError>> {
    if (!input.activityId && !input.indicatorId) {
      return { ok: false, error: DomainError.validation("Either activityId or indicatorId must be provided") };
    }
    if (input.activityId) {
      const r = await this.linker.attachToActivity(ctx, input.evidenceId, input.activityId);
      if (!r.ok) return r;
    }
    if (input.indicatorId) {
      const r = await this.linker.attachToIndicator(ctx, input.evidenceId, input.indicatorId);
      if (!r.ok) return r;
    }
    return { ok: true, value: undefined };
  }
}
