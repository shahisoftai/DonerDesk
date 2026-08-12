import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";

export class ListLogframeHandler {
  constructor(private readonly items: ILogframeRepository, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ items: unknown[]; indicators: unknown[] }, DomainError>> {
    const itemResult = await this.items.findByProject(projectId, ctx.tenant.tenantId);
    const indResult = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!itemResult.ok) return itemResult;
    if (!indResult.ok) return indResult;
    return {
      ok: true,
      value: {
        items: itemResult.value.map((i) => ({
          id: i.id,
          parentId: i.parentId,
          level: i.level,
          code: i.code,
          title: i.title,
          description: i.description,
        })),
        indicators: indResult.value.map((i) => ({
          id: i.id,
          logframeItemId: i.logframeItemId,
          code: i.code,
          name: i.name,
          type: i.type,
          baseline: i.baseline,
          target: i.target,
          unit: i.unit,
          meansOfVerification: i.meansOfVerification,
          dataSource: i.dataSource,
          frequency: i.frequency,
          responsibleUserId: i.responsibleUserId,
          disaggregationRequired: i.disaggregationRequired,
        })),
      },
    };
  }
}
