import type { Result, AgentMemory } from "@donordesk/domain";
import { DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAgentMemoryRepository } from "../../ports/agent-memory.js";

/** Backs the Settings tab's "Suggestions waiting for you" and "Active style preferences" lists. */
export class ListPendingAgentMemoryHandler {
  constructor(private readonly agentMemory: IAgentMemoryRepository) {}

  async handle(ctx: AuthenticatedContext, status: "PROPOSED" | "ACTIVE"): Promise<Result<AgentMemory[], DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "report.manage-agent-memory")) {
      return {
        ok: false,
        error: DomainError.forbidden("Only report managers can view learned style guidance", {
          capability: "report.manage-agent-memory",
        }),
      };
    }
    return status === "ACTIVE"
      ? this.agentMemory.findActive(ctx.tenant.tenantId)
      : this.agentMemory.findPending(ctx.tenant.tenantId);
  }
}
