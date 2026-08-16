import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateProjectMemberInput } from "@donordesk/contracts";

export class UpdateProjectMemberHandler {
  constructor(
    private readonly members: IProjectMemberRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, memberId: string, input: UpdateProjectMemberInput): Promise<Result<void, DomainError>> {
    const result = await this.members.findById(memberId, ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("ProjectMember", memberId) };
    const member = result.value;

    const before = JSON.stringify(member.toValue());
    member.changeRole(input.role);
    const saved = await this.members.update(member);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.member.role_changed",
      entityType: "project_member",
      entityId: memberId,
      projectId: member.projectId,
      oldValue: before,
      newValue: JSON.stringify(member.toValue()),
    });
    return { ok: true, value: undefined };
  }
}
