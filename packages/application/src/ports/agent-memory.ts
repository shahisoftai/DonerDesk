import type {
  Result,
  TenantId,
  DomainError,
  AgentMemory,
  AgentMemoryScope,
  AgentMemoryCategory,
  AgentMemoryProvenance,
} from "@donordesk/domain";

/**
 * A style/terminology pattern an extractor observed in one reviewer edit.
 * Never carries a number, date, or figure — the extraction-time hunk filter
 * (`excludeNumericHunks`, domain) and the `AgentMemory` entity's own
 * construction guard both reject candidates that would smuggle one through.
 */
export interface AgentMemoryCandidate {
  scope: AgentMemoryScope;
  scopeId: string | null;
  category: AgentMemoryCategory;
  statement: string;
  provenance: AgentMemoryProvenance;
}

export interface IAgentMemoryRepository {
  /**
   * Persists each candidate as a new PROPOSED row, EXCEPT when an existing
   * PROPOSED or ACTIVE row already matches on (scope, scopeId, category,
   * statement) — that row is reinforced (occurrenceCount bumped) instead of
   * duplicated.
   */
  proposeMany(tenantId: TenantId, candidates: AgentMemoryCandidate[]): Promise<Result<AgentMemory[], DomainError>>;
  findById(id: string, tenantId: TenantId): Promise<Result<AgentMemory | null, DomainError>>;
  findPending(tenantId: TenantId, scope?: AgentMemoryScope): Promise<Result<AgentMemory[], DomainError>>;
  /**
   * ACTIVE memories applicable to a generation context, broadest-scope-first
   * (SECTION_TYPE for this section title, then TEMPLATE/DONOR, then
   * ORGANIZATION), capped by the caller to a small count.
   */
  findActiveForContext(
    tenantId: TenantId,
    ctx: { donorTemplateId?: string; sectionTitle: string },
  ): Promise<Result<AgentMemory[], DomainError>>;
  findActive(tenantId: TenantId): Promise<Result<AgentMemory[], DomainError>>;
  update(memory: AgentMemory): Promise<Result<AgentMemory, DomainError>>;
}

/**
 * Turns filtered (numeric-hunk-free) content into candidate style statements.
 * `DeterministicMemoryExtractor` (default, no LLM call) and a future
 * LLM-assisted extractor are interchangeable behind this port.
 */
export interface IAgentMemoryExtractor {
  extract(input: {
    tenantId: TenantId;
    sectionTitle: string;
    donorTemplateId?: string;
    priorContent: string;
    editedContent: string;
  }): Promise<Result<AgentMemoryCandidate[], DomainError>>;
}
