import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";

export class ListProjectMembersHandler {
  constructor(private readonly members: IProjectMemberRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<import("@donordesk/domain").ProjectMember[], DomainError>> {
    return this.members.findByProject(projectId, ctx.tenant.tenantId);
  }
}
