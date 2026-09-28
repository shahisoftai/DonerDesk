/**
 * Agent Memory (Phase 21) generation-time injection. `agentMemoryBriefFields`
 * mirrors `donorBriefFields` in shape (pure, formatting only, no persistence,
 * no LLM call) and folds into the SAME `sectionGuidance: string[]` array
 * `buildSectionSpecificGuidance` already produces — the codebase's one SSOT
 * for editorial guidance, shared by both report-draft generators and the
 * Python worker's `SectionBrief.sectionGuidance`. No new wire field is added.
 */
import type { AgentMemory } from "@donordesk/domain";
import type { IAgentMemoryRepository } from "@donordesk/application";
import type { TenantId } from "@donordesk/domain";
import { AGENT_MEMORY_BRIEF_MAX_STATEMENTS } from "../repositories/agent-memory-repository.js";

export function agentMemoryBriefFields(records: AgentMemory[]): string[] {
  return records.slice(0, AGENT_MEMORY_BRIEF_MAX_STATEMENTS).map((m) => m.statement);
}

/**
 * Binds a per-tenant, read-only lookup closure the report-draft generators
 * call once per section. Constructed at the composition root (`container.ts`)
 * ONLY when both the platform `AGENT_MEMORY_ENABLED` flag and the tenant's
 * `Organization.agentMemoryEnabled` toggle are on — every other combination
 * leaves the generator's `agentMemoryLookup` undefined, so `sectionGuidance`
 * stays byte-identical to pre-Phase-21 output (§8, §14).
 */
export function createAgentMemoryLookup(
  agentMemory: IAgentMemoryRepository,
  tenantId: TenantId,
): (sectionTitle: string, donorTemplateId?: string) => Promise<string[]> {
  return async (sectionTitle, donorTemplateId) => {
    const result = await agentMemory.findActiveForContext(tenantId, { sectionTitle, donorTemplateId });
    if (!result.ok) return [];
    return agentMemoryBriefFields(result.value);
  };
}
