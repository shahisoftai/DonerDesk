import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { extractNumericAtoms } from "../reporting/numeric-atom.js";

/**
 * Agent Memory — learned tenant/donor style guidance (Phase 21). This context
 * sits entirely on the "narration" side of DonorDesk's numbers/facts boundary
 * (see `numeric-atom.ts` and the reporting assurance pipeline): a memory can
 * only ever describe HOW a section should be worded, never WHAT it claims.
 */
export type AgentMemoryScope = "ORGANIZATION" | "DONOR" | "TEMPLATE" | "SECTION_TYPE";
export const AGENT_MEMORY_SCOPES: AgentMemoryScope[] = ["ORGANIZATION", "DONOR", "TEMPLATE", "SECTION_TYPE"];

export type AgentMemoryCategory = "TONE" | "STRUCTURE" | "TERMINOLOGY" | "FORMATTING" | "LENGTH";
export const AGENT_MEMORY_CATEGORIES: AgentMemoryCategory[] = ["TONE", "STRUCTURE", "TERMINOLOGY", "FORMATTING", "LENGTH"];

export type AgentMemoryStatus = "PROPOSED" | "ACTIVE" | "REJECTED" | "SUPERSEDED" | "DEACTIVATED";
export const AGENT_MEMORY_STATUSES: AgentMemoryStatus[] = ["PROPOSED", "ACTIVE", "REJECTED", "SUPERSEDED", "DEACTIVATED"];

export type AgentMemoryConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Legal `from -> to` transitions. No other transition exists. */
const ALLOWED_TRANSITIONS: Record<AgentMemoryStatus, ReadonlySet<AgentMemoryStatus>> = {
  PROPOSED: new Set<AgentMemoryStatus>(["ACTIVE", "REJECTED"]),
  ACTIVE: new Set<AgentMemoryStatus>(["DEACTIVATED", "SUPERSEDED"]),
  REJECTED: new Set<AgentMemoryStatus>([]),
  SUPERSEDED: new Set<AgentMemoryStatus>([]),
  DEACTIVATED: new Set<AgentMemoryStatus>([]),
};

export const AGENT_MEMORY_STATEMENT_MAX_LENGTH = 200;

/** One edit that reinforced this statement. Provenance is append-only. */
export interface AgentMemoryProvenance {
  sourceRevisionId: string;
  parentRevisionId: string;
  sectionId: string;
  occurrenceCount: number;
  lastObservedAt: Date;
}

export interface AgentMemoryProps {
  scope: AgentMemoryScope;
  scopeId: string | null;
  category: AgentMemoryCategory;
  statement: string;
  confidence: AgentMemoryConfidence;
  status: AgentMemoryStatus;
  provenance: AgentMemoryProvenance[];
  approvedById: string | null;
  approvedAt: Date | null;
}

/**
 * True when `text` contains a numeric atom, currency, percentage, or ISO/
 * calendar date — reusing the same detector the claim-verification pipeline
 * uses to find report-value numbers. This is the domain-level belt (layer 2
 * of the plan's three-layer defence): even if a misbehaving extractor
 * proposed a candidate carrying a figure, the entity refuses to hold it.
 */
export function containsNumericContent(text: string): boolean {
  return extractNumericAtoms(text).length > 0;
}

/**
 * Layer 1 of the plan's defence-in-depth (§7): splits `text` into
 * paragraph-level hunks and drops any hunk carrying a numeric atom, currency
 * symbol, percentage, or date — before it ever reaches an extractor
 * (deterministic or LLM-assisted). Pure and deterministic; reuses the same
 * atom detector `containsNumericContent` uses, so a hunk that survives this
 * filter but somehow still carries a figure is still caught at construction.
 */
export function excludeNumericHunks(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((hunk) => !containsNumericContent(hunk))
    .join("\n\n");
}

function deriveConfidence(occurrenceCount: number): AgentMemoryConfidence {
  if (occurrenceCount >= 5) return "HIGH";
  if (occurrenceCount >= 2) return "MEDIUM";
  return "LOW";
}

export class AgentMemory extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: AgentMemoryProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  private static validateStatement(statement: string): void {
    const trimmed = statement.trim();
    if (trimmed.length === 0) {
      throw DomainError.validation("AgentMemory statement cannot be empty");
    }
    if (trimmed.length > AGENT_MEMORY_STATEMENT_MAX_LENGTH) {
      throw DomainError.validation(
        `AgentMemory statement must be at most ${AGENT_MEMORY_STATEMENT_MAX_LENGTH} characters`,
        { maxLength: AGENT_MEMORY_STATEMENT_MAX_LENGTH },
      );
    }
    // Layer 2 of the plan's defence-in-depth (§7): a statement carrying any
    // numeric/date/currency atom can never be constructed, independent of
    // whether the extraction-time hunk filter (layer 1) already ran.
    if (containsNumericContent(trimmed)) {
      throw DomainError.validation(
        "AgentMemory statement must describe style, never a fact or figure",
        { reason: "numeric_content", statement: trimmed },
      );
    }
  }

  /** Proposes a brand-new statement. Always starts PROPOSED — there is no path to an already-active memory. */
  static propose(input: {
    id: string;
    tenantId: TenantId;
    scope: AgentMemoryScope;
    scopeId: string | null;
    category: AgentMemoryCategory;
    statement: string;
    provenance: AgentMemoryProvenance;
  }): AgentMemory {
    const statement = input.statement.trim();
    AgentMemory.validateStatement(statement);
    return new AgentMemory(input.id, input.tenantId, {
      scope: input.scope,
      scopeId: input.scopeId,
      category: input.category,
      statement,
      confidence: deriveConfidence(input.provenance.occurrenceCount),
      status: "PROPOSED",
      provenance: [input.provenance],
      approvedById: null,
      approvedAt: null,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: AgentMemoryProps;
    createdAt: Date;
    updatedAt: Date;
  }): AgentMemory {
    return new AgentMemory(input.id, input.tenantId, input.props, input.createdAt, input.updatedAt);
  }

  get scope(): AgentMemoryScope { return this.props.scope; }
  get scopeId(): string | null { return this.props.scopeId; }
  get category(): AgentMemoryCategory { return this.props.category; }
  get statement(): string { return this.props.statement; }
  get confidence(): AgentMemoryConfidence { return this.props.confidence; }
  get status(): AgentMemoryStatus { return this.props.status; }
  get provenance(): AgentMemoryProvenance[] { return [...this.props.provenance]; }
  get approvedById(): string | null { return this.props.approvedById; }
  get approvedAt(): Date | null { return this.props.approvedAt; }
  get occurrenceCount(): number {
    return this.props.provenance.reduce((sum, p) => sum + p.occurrenceCount, 0);
  }

  private assertTransition(to: AgentMemoryStatus): void {
    if (!ALLOWED_TRANSITIONS[this.props.status].has(to)) {
      throw DomainError.invalidTransition(
        `AgentMemory cannot transition from ${this.props.status} to ${to}`,
        { id: this.id, from: this.props.status, to },
      );
    }
  }

  /** Bumps occurrence count instead of creating a duplicate row (deduplication). */
  reinforce(provenance: AgentMemoryProvenance): void {
    this.props.provenance = [...this.props.provenance, provenance];
    this.props.confidence = deriveConfidence(this.occurrenceCount);
    this.touch();
  }

  /** Human sign-off. `status` can only reach ACTIVE through this explicit transition. */
  approve(approvedById: string, scope?: AgentMemoryScope, scopeId?: string | null): void {
    this.assertTransition("ACTIVE");
    if (scope) this.props.scope = scope;
    if (scope) this.props.scopeId = scopeId ?? null;
    this.props.status = "ACTIVE";
    this.props.approvedById = approvedById;
    this.props.approvedAt = new Date();
    this.touch();
  }

  reject(): void {
    this.assertTransition("REJECTED");
    this.props.status = "REJECTED";
    this.touch();
  }

  /** Reversible pause; provenance and history are retained, never deleted. */
  deactivate(): void {
    this.assertTransition("DEACTIVATED");
    this.props.status = "DEACTIVATED";
    this.touch();
  }

  supersede(): void {
    this.assertTransition("SUPERSEDED");
    this.props.status = "SUPERSEDED";
    this.touch();
  }
}
