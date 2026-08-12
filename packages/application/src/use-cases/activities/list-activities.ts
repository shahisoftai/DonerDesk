import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import { toActivityUpdateDto } from "./dto.js";

export class ListActivitiesHandler {
  constructor(private readonly repo: IActivityUpdateRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((a) => toActivityUpdateDto(a)),
    };
  }
}
