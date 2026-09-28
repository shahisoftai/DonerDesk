import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, type Role, type AgentMemoryScope } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAgentMemoryRepository } from "../../ports/agent-memory.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ApproveAgentMemoryInput {
  /** The reviewer's "Applies to" choice at approval time; widens/narrows the extractor's proposed scope. */
  scope?: AgentMemoryScope;
  scopeId?: string | null;
}

/** Human sign-off — the only path an AgentMemory statement can reach ACTIVE, and therefore influence generation. */
export class ApproveAgentMemoryHandler {
  constructor(
    private readonly agentMemory: IAgentMemoryRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, id: string, input: ApproveAgentMemoryInput = {}): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "report.manage-agent-memory")) {
      return {
        ok: false,
        error: DomainError.forbidden("Only report managers can approve learned style guidance", {
          capability: "report.manage-agent-memory",
        }),
      };
    }

    const found = await this.agentMemory.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("AgentMemory", id) };
    const memory = found.value;

    memory.approve(ctx.tenant.userId, input.scope, input.scopeId);
    const saved = await this.agentMemory.update(memory);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "agent_memory.approved",
      entityType: "agent_memory",
      entityId: id,
      newValue: JSON.stringify({ scope: memory.scope, scopeId: memory.scopeId, statement: memory.statement }),
    });

    return { ok: true, value: undefined };
  }
}
