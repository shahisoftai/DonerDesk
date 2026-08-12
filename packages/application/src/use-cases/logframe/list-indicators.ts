import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";

export class ListIndicatorsHandler {
  constructor(private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: r.value };
  }
}
