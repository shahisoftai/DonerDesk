import type { Result } from "@donordesk/domain";
import { DomainError, resolveActivityNodeLink } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { ILogframeRepository } from "../ports/logframe.js";

export interface ActivityLinkInput {
  logframeActivityId?: string | undefined;
  outputId?: string | undefined;
}

/**
 * Validates an activity's link to the logframe against the project's own items (the rule lives in
 * the domain's `resolveActivityNodeLink`) and returns the consistent pair to store. A request that
 * names no logframe item costs no lookup.
 */
export class ActivityLinkResolver {
  constructor(private readonly logframe: ILogframeRepository) {}

  async resolve(ctx: AuthenticatedContext, projectId: string, link: ActivityLinkInput): Promise<Result<{ logframeActivityId?: string; outputId?: string }, DomainError>> {
    if (!link.logframeActivityId && !link.outputId) return { ok: true, value: {} };
    const items = await this.logframe.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const resolved = resolveActivityNodeLink(
      items.value.map((i) => ({ id: i.id, parentId: i.parentId, level: i.level, title: i.title })),
      link,
    );
    if (!resolved.ok) return { ok: false, error: DomainError.validation(resolved.message) };
    return { ok: true, value: resolved.value };
  }
}
