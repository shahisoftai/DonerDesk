import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import { toActivityUpdateDto } from "./dto.js";

export class GetActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository) {}

  async handle(ctx: AuthenticatedContext, activityId: string): Promise<Result<unknown, DomainError>> {
    const r = await this.repo.findById(activityId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    return { ok: true, value: toActivityUpdateDto(r.value) };
  }
}
