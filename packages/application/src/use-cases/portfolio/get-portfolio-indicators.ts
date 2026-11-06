import { ok, rollUpIndicators, type DomainError, type Result, type RollupGroup } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPortfolioValueReader } from "../../ports/portfolio.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import { VisibleProjects } from "../../services/visible-projects.js";

/**
 * Indicators summed across the projects a person can see, per donor and code. The same visibility rule as the project list,
 * so a roll-up never shows a project its reader is not on.
 */
export class GetPortfolioIndicatorsHandler {
  constructor(private readonly projects: IProjectRepository, private readonly members: IProjectMemberRepository, private readonly values: IPortfolioValueReader) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<RollupGroup[], DomainError>> {
    const visible = await new VisibleProjects(this.projects, this.members).for(ctx);
    if (!visible.ok) return visible;
    const ids = visible.value.map((p) => p.id);
    if (ids.length === 0) return ok([]);
    const rows = await this.values.indicatorValues(ids, ctx.tenant.tenantId);
    if (!rows.ok) return rows;
    const allowed = new Set(ids);
    return ok(rollUpIndicators(rows.value.filter((r) => allowed.has(r.projectId))));
  }
}
