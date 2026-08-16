import type { Result } from "@donordesk/domain";
import { DomainError, ProjectMember } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger, INotificationPort } from "../../ports/core.js";
import type { AssignProjectMemberInput } from "@donordesk/contracts";

export class AssignProjectMemberHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly members: IProjectMemberRepository,
    private readonly projects: IProjectRepository,
    private readonly users: IUserRepository,
    private readonly audit: IAuditLogger,
    private readonly notify: INotificationPort,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: AssignProjectMemberInput): Promise<Result<{ id: string }, DomainError>> {
    const projectResult = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const userResult = await this.users.findById(input.userId, ctx.tenant.tenantId);
    if (!userResult.ok) return userResult;
    if (!userResult.value) return { ok: false, error: DomainError.notFound("User", input.userId) };
    if (userResult.value.status === "REMOVED") {
      return { ok: false, error: DomainError.validation("Cannot assign a removed user to a project") };
    }

    const existingResult = await this.members.findByUserAndProject(projectId, input.userId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    if (existingResult.value) {
      return { ok: false, error: DomainError.conflict("User is already assigned to this project") };
    }

    const id = this.ids.generate();
    const member = ProjectMember.create({
      id,
      tenantId: ctx.tenant.tenantId,
      projectId,
      userId: input.userId,
      role: input.role,
      assignedById: ctx.tenant.userId,
    });
    const saved = await this.members.create(member);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.member.assigned",
      entityType: "project_member",
      entityId: id,
      projectId,
      newValue: JSON.stringify({ userId: input.userId, role: input.role }),
    });
    await this.notify.notify({
      tenantId: ctx.tenant.tenantId,
      recipientId: input.userId,
      type: "ASSIGNMENT",
      title: `Assigned to project: ${projectResult.value.title}`,
      message: `You have been assigned the ${input.role.replace(/_/g, " ")} role on ${projectResult.value.title}.`,
      relatedEntityType: "project",
      relatedEntityId: projectId,
    });

    return { ok: true, value: { id } };
  }
}
