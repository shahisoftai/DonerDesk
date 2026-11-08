import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";

/**
 * Whether a project code is still free in the workspace, asked while a person types it (the wizard) so a taken code is known before
 * the project is started. It answers only yes or no: it never says which project holds the code, so it shows nothing the person may
 * not see. The create itself stays the real guard (the unique index); this is a courtesy that spares a failed launch.
 */
export class CheckProjectCodeHandler {
  constructor(private readonly projects: IProjectRepository) {}

  async handle(ctx: AuthenticatedContext, code: string): Promise<Result<{ available: boolean }, DomainError>> {
    const wanted = code.trim();
    if (wanted === "") return { ok: true, value: { available: true } };
    const found = await this.projects.findByCode(ctx.tenant.tenantId, wanted);
    if (!found.ok) return found;
    return { ok: true, value: { available: found.value === null } };
  }
}
