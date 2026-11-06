import { ok, type DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";

export interface ProjectPersonDto {
  userId: string;
  /** Name only: a teammate's email stays with the people who manage the team. */
  name: string;
  role: string;
}

/** The active members of a project with their names, for anyone who can view the project (lead pickers, "Only mine"). */
export class ListProjectPeopleHandler {
  constructor(private readonly members: IProjectMemberRepository, private readonly users: IUserRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectPersonDto[], DomainError>> {
    const members = await this.members.findByProject(projectId, ctx.tenant.tenantId);
    if (!members.ok) return members;
    const users = await this.users.listByTenant(ctx.tenant.tenantId);
    if (!users.ok) return users;
    const nameOf = new Map(users.value.map((u) => [u.id.toString(), u.name] as const));
    return ok(
      members.value
        .filter((m) => m.status === "ACTIVE" && nameOf.has(m.userId))
        .map((m) => ({ userId: m.userId, name: nameOf.get(m.userId)!, role: m.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
}
