import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAgentMemoryRepository } from "../../ports/agent-memory.js";
import type { IAuditLogger } from "../../ports/core.js";

export class RejectAgentMemoryHandler {
  constructor(
    private readonly agentMemory: IAgentMemoryRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "report.manage-agent-memory")) {
      return {
        ok: false,
        error: DomainError.forbidden("Only report managers can reject learned style guidance", {
          capability: "report.manage-agent-memory",
        }),
      };
    }

    const found = await this.agentMemory.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("AgentMemory", id) };
    const memory = found.value;

    memory.reject();
    const saved = await this.agentMemory.update(memory);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "agent_memory.rejected",
      entityType: "agent_memory",
      entityId: id,
    });

    return { ok: true, value: undefined };
  }
}
