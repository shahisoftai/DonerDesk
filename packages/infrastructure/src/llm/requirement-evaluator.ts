import type {
  IRequirementEvaluator,
  RequirementEvaluationInput,
  RequirementEvaluationResult,
} from "@donordesk/application";
import type { Result, DomainError, ResolvedReportingRequirements } from "@donordesk/domain";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function keyToTitle(key: string): string {
  const part = key.includes(":") ? key.split(":")[1] ?? key : key;
  return normalize(part);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Deterministic requirement evaluator (Phase 5). A requirement is satisfied
 * when a plan section declares its key explicitly (`requirementKeys`) or its
 * normalized title matches. Mandatory blocking requirements left unsatisfied,
 * and required questions that are empty or exceed their word limit, become
 * blocking results that feed the REQUIREMENT_UNSATISFIED gate.
 */
export class DeterministicRequirementEvaluator implements IRequirementEvaluator {
  async evaluate(input: RequirementEvaluationInput): Promise<Result<RequirementEvaluationResult, DomainError>> {
    const satisfied = new Set<string>();
    const blockedReasons = new Map<string, string>();

    const keyToSectionIndex = new Map<string, number>();
    input.sectionRequirementKeys.forEach((keys, index) => {
      for (const key of keys) keyToSectionIndex.set(key, index);
    });

    const normalizedTitles = input.sectionTitles.map(normalize);

    for (const requirement of input.requirements) {
      const keyText = keyToTitle(requirement.key);
      const explicitIndex = keyToSectionIndex.get(requirement.key);
      const titleMatch = normalizedTitles.some((t) => t === keyText || t.includes(keyText) || keyText.includes(t));

      if (explicitIndex !== undefined || titleMatch) {
        satisfied.add(requirement.key);
        const sectionIndex = explicitIndex ?? normalizedTitles.findIndex((t) => t === keyText || t.includes(keyText) || keyText.includes(t));
        // Word-limit enforcement for required questions with a declared limit.
        if (requirement.kind === "QUESTION" && requirement.wordLimit && sectionIndex >= 0) {
          const content = input.sectionContents[sectionIndex] ?? "";
          const words = wordCount(content);
          if (requirement.required && words === 0) {
            blockedReasons.set(requirement.key, `Required question is empty: ${requirement.key}`);
          } else if (requirement.wordLimit.max !== undefined && words > requirement.wordLimit.max) {
            blockedReasons.set(requirement.key, `Exceeds ${requirement.wordLimit.max}-word limit: ${requirement.key}`);
          }
        }
      } else if (requirement.required && requirement.severity === "BLOCKING") {
        blockedReasons.set(requirement.key, `Mandatory requirement unsatisfied: ${requirement.key}`);
      }
    }

    const unmet = [...blockedReasons.keys()].filter((key) => !satisfied.has(key));
    // A satisfied-but-over-limit question is still a blocking defect even though
    // the requirement is "present": keep its blocking reason.
    const blocking = [...blockedReasons.entries()].map(([key, reason]) => ({ key, reason }));

    return {
      ok: true,
      value: {
        satisfied: [...satisfied],
        unmet,
        blocking,
      },
    };
  }
}

export type { ResolvedReportingRequirements };
