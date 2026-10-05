import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceLinker } from "../../ports/evidence-linker.js";

export interface DetachEvidenceInput {
  evidenceId: string;
  activityId?: string;
  indicatorId?: string;
}

/** Removes the proof link between a file and an activity / indicator update. All linking rules live in `IEvidenceLinker`. */
export class DetachEvidenceHandler {
  constructor(private readonly linker: IEvidenceLinker) {}

  async handle(ctx: AuthenticatedContext, input: DetachEvidenceInput): Promise<Result<void, DomainError>> {
    if (!input.activityId && !input.indicatorId) {
      return { ok: false, error: DomainError.validation("Either activityId or indicatorId must be provided") };
    }
    if (input.activityId) {
      const r = await this.linker.detachFromActivity(ctx, input.evidenceId, input.activityId);
      if (!r.ok) return r;
    }
    if (input.indicatorId) {
      const r = await this.linker.detachFromIndicator(ctx, input.evidenceId, input.indicatorId);
      if (!r.ok) return r;
    }
    return { ok: true, value: undefined };
  }
}
