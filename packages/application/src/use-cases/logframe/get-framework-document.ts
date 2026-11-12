import type { FrameworkDocument, Result } from "@donordesk/domain";
import { DEFAULT_VOCABULARY, DomainError, FRAMEWORK_LENSES, Permissions, buildLogframeSnapshot, isFrameworkLens, renderFramework, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, ILogframeRepository } from "../../ports/logframe.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";

/** The project's framework as one lens reads it, in the donor's own words (Phase 52.2). Reads only; the screen and every file draw this. */
export class GetFrameworkDocumentHandler {
  constructor(
    private readonly items: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly profiles: IReportingProfileRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, lens: string): Promise<Result<FrameworkDocument, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return { ok: false, error: DomainError.forbidden("You cannot view this framework") };
    if (!isFrameworkLens(lens)) return { ok: false, error: DomainError.validation("Choose Results Framework or Logframe") };
    const items = await this.items.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const indicators = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!indicators.ok) return indicators;
    const profile = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!profile.ok) return profile;
    const snapshot = buildLogframeSnapshot(items.value, indicators.value);
    return { ok: true, value: renderFramework(snapshot, FRAMEWORK_LENSES[lens], profile.value?.vocabulary ?? DEFAULT_VOCABULARY) };
  }
}
