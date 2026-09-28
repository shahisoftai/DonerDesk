/**
 * Default (no LLM call) Agent Memory extractor. Each rule is a pure,
 * independently testable function comparing filtered prior/edited section
 * content and proposing at most one style candidate. `IAgentMemoryExtractor`
 * is interchangeable with a future LLM-assisted extractor behind the same
 * port (OCP) — nothing else in the pipeline depends on this class directly.
 *
 * Input content has already passed the domain's `excludeNumericHunks` filter
 * (layer 1 of the plan's defence-in-depth, §7); this extractor never sees a
 * numeric/date/currency-bearing hunk. `AgentMemory.propose()` (layer 2)
 * independently re-checks every statement before it can be constructed.
 */
import type { TenantId, AgentMemoryCategory, AgentMemoryProvenance } from "@donordesk/domain";
import { type Result } from "@donordesk/domain";
import type { IAgentMemoryExtractor, AgentMemoryCandidate } from "@donordesk/application";

const PASSIVE_RE = /\b(?:was|were|is|are|been|being)\s+\w+ed\b/gi;
const HEADING_RE = /^#{2,4}\s+/gm;
const BULLET_RE = /^\s*[-*]\s+/gm;

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

interface Rule {
  category: AgentMemoryCategory;
  statement: (sectionTitle: string) => string;
  triggers: (prior: string, edited: string) => boolean;
}

const RULES: Rule[] = [
  {
    category: "LENGTH",
    statement: () => "Keep this section concise; reviewers consistently trim narrative padding.",
    triggers: (prior, edited) => {
      const priorWords = wordCount(prior);
      const editedWords = wordCount(edited);
      return priorWords >= 40 && editedWords > 0 && editedWords <= priorWords * 0.7 && priorWords - editedWords >= 20;
    },
  },
  {
    category: "TONE",
    statement: () => "Prefer the active voice and name the actor, rather than passive constructions.",
    triggers: (prior, edited) => {
      const priorPassive = countMatches(prior, PASSIVE_RE);
      const editedPassive = countMatches(edited, PASSIVE_RE);
      return priorPassive >= 2 && editedPassive <= Math.max(0, priorPassive - 2);
    },
  },
  {
    category: "STRUCTURE",
    statement: () => "Break this section into subheadings rather than one continuous block of prose.",
    triggers: (prior, edited) => countMatches(prior, HEADING_RE) === 0 && countMatches(edited, HEADING_RE) >= 2,
  },
  {
    category: "STRUCTURE",
    statement: () => "Present this content as a bulleted list rather than narrative prose.",
    triggers: (prior, edited) => {
      const priorBullets = countMatches(prior, BULLET_RE);
      const editedBullets = countMatches(edited, BULLET_RE);
      return priorBullets === 0 && editedBullets >= 3;
    },
  },
];

export class DeterministicMemoryExtractor implements IAgentMemoryExtractor {
  async extract(input: {
    tenantId: TenantId;
    sectionTitle: string;
    donorTemplateId?: string;
    priorContent: string;
    editedContent: string;
  }): Promise<Result<AgentMemoryCandidate[], import("@donordesk/domain").DomainError>> {
    const now = new Date();
    const candidates: AgentMemoryCandidate[] = [];
    for (const rule of RULES) {
      if (!rule.triggers(input.priorContent, input.editedContent)) continue;
      const provenance: AgentMemoryProvenance = {
        sourceRevisionId: "",
        parentRevisionId: "",
        sectionId: "",
        occurrenceCount: 1,
        lastObservedAt: now,
      };
      candidates.push({
        scope: "SECTION_TYPE",
        scopeId: input.sectionTitle,
        category: rule.category,
        statement: rule.statement(input.sectionTitle),
        provenance,
      });
    }
    return { ok: true, value: candidates };
  }
}
