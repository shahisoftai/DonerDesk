import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";

export interface ArchivedIndicatorView {
  id: string;
  code: string;
  name: string;
  logframeItemId: string;
  archivedAt: string;
}

/** The project's archived indicators, newest first, so one can be restored. */
export class ListArchivedIndicatorsHandler {
  constructor(private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ items: ArchivedIndicatorView[] }, DomainError>> {
    const all = await this.indicators.findByProject(projectId, ctx.tenant.tenantId, { includeArchived: true });
    if (!all.ok) return all;
    const items = all.value
      .filter((i) => i.archivedAt !== undefined)
      .sort((a, b) => (b.archivedAt?.getTime() ?? 0) - (a.archivedAt?.getTime() ?? 0))
      .map((i) => ({ id: i.id, code: i.code, name: i.name, logframeItemId: i.logframeItemId, archivedAt: (i.archivedAt as Date).toISOString() }));
    return { ok: true, value: { items } };
  }
}
