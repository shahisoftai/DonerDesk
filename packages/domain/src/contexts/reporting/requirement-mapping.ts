import type { ReportPlanSection } from "./report-plan.js";
import type { ReportingRequirement, RequirementKind } from "./reporting-requirement.js";

/**
 * Deterministic requirement → plan-section mapping (donor-quality remediation
 * WS1). Pure functions only: no I/O, no LLM, no infrastructure. The planner
 * uses these to stamp `requirementKeys`, `mandatoryQuestions`, and
 * `requirementGuidance` onto plan sections so that (a) the requirement
 * evaluator can use exact key coverage and (b) the narrators receive the
 * donor's own guidance in their prompts.
 *
 * SOLID: SRP — this module owns matching policy and nothing else. OCP — kind
 * behaviour is a data table (`KIND_POLICY`); adding a requirement kind or a
 * new matching rule is a data change, not a new conditional in callers.
 */

/** Extracted topic of a requirement key: `"QUESTION:safeguarding-psea"` → `"safeguarding psea"`. */
export function requirementTopic(requirement: ReportingRequirement): string {
  const key = requirement.key ?? "";
  const idx = key.indexOf(":");
  const topic = idx >= 0 ? key.slice(idx + 1) : key;
  return normalizeText(topic);
}

export function normalizeText(text: string): string {
  return (text ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Stopwords that would otherwise match nearly every section title. */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "report",
  "section",
  "question",
  "mandatory",
  "required",
  "information",
  "narrative",
  "summary",
]);

function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t));
}

export interface RequirementSectionScore {
  sectionIndex: number;
  /** Token-overlap score; 0 means no topical evidence. */
  score: number;
}

/**
 * Scores one requirement against one section. Title tokens weigh double
 * (titles are the donor's own naming), evidence needs and logframe element
 * weigh single. Deterministic: same inputs → same score.
 */
export function scoreRequirementAgainstSection(
  requirement: ReportingRequirement,
  section: ReportPlanSection,
): RequirementSectionScore {
  const topicTokens = new Set(contentTokens(requirementTopic(requirement)));
  // Guidance can carry the donor's own naming for the target section.
  for (const token of contentTokens(requirement.guidance ?? "")) topicTokens.add(token);
  if (topicTokens.size === 0) return { sectionIndex: -1, score: 0 };

  const titleTokens = new Set(contentTokens(section.title));
  const contextTokens = new Set([
    ...(section.evidenceNeeds ?? []).flatMap((n) => contentTokens(n)),
    ...contentTokens(section.relatedLogframeElement ?? ""),
  ]);

  let score = 0;
  for (const token of topicTokens) {
    if (titleTokens.has(token)) score += 2;
    else if (contextTokens.has(token)) score += 1;
  }
  return { sectionIndex: -1, score };
}

export interface SectionMatch {
  /** Index into the sections array; -1 when nothing scored above zero. */
  sectionIndex: number;
  score: number;
  /** How many sections tied for the best score (1 = unique winner). */
  ties: number;
}

/**
 * Best deterministic match for a requirement across the plan sections.
 * Ties break to the earliest section (stable order = template order).
 */
export function matchRequirementToSection(
  requirement: ReportingRequirement,
  sections: ReadonlyArray<ReportPlanSection>,
): SectionMatch {
  let bestIndex = -1;
  let bestScore = 0;
  let ties = 0;
  for (let i = 0; i < sections.length; i++) {
    const { score } = scoreRequirementAgainstSection(requirement, sections[i]!);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
      ties = 1;
    } else if (score === bestScore && score > 0) {
      ties++;
    }
  }
  return { sectionIndex: bestIndex, score: bestScore, ties };
}

/** Behaviour of one requirement kind during stamping. Data, not conditionals. */
interface KindPolicy {
  /** Stamp `requirementKeys` on the matched section. */
  stampKeys: boolean;
  /** Stamp `guidance` into `requirementGuidance` on the matched section. */
  stampGuidance: boolean;
  /** Add a mandatory question to the matched section. */
  stampQuestion: boolean;
  /** Fallback section when nothing matched: -1 none, 0 first, -2 last. */
  fallback: -1 | 0 | -2;
}

const KIND_POLICY: Record<RequirementKind, KindPolicy> = {
  SECTION: { stampKeys: true, stampGuidance: true, stampQuestion: false, fallback: -1 },
  QUESTION: { stampKeys: true, stampGuidance: true, stampQuestion: true, fallback: -2 },
  FIELD: { stampKeys: true, stampGuidance: true, stampQuestion: false, fallback: -1 },
  INDICATOR: { stampKeys: true, stampGuidance: false, stampQuestion: false, fallback: -1 },
  ANNEX: { stampKeys: true, stampGuidance: false, stampQuestion: false, fallback: -1 },
  DECLARATION: { stampKeys: true, stampGuidance: true, stampQuestion: false, fallback: 0 },
  FINANCIAL: { stampKeys: true, stampGuidance: true, stampQuestion: false, fallback: -1 },
  SAFEGUARD: { stampKeys: true, stampGuidance: true, stampQuestion: false, fallback: -1 },
  APPROVAL: { stampKeys: true, stampGuidance: false, stampQuestion: false, fallback: -1 },
  DEADLINE: { stampKeys: true, stampGuidance: false, stampQuestion: false, fallback: -1 },
  FORMAT: { stampKeys: true, stampGuidance: false, stampQuestion: false, fallback: -1 },
};

/** Question text for QUESTION-kind requirements: the donor's guidance when present, else the prettified topic. */
export function mandatoryQuestionText(requirement: ReportingRequirement): string {
  const guidance = (requirement.guidance ?? "").trim();
  if (guidance) return guidance;
  const topic = requirementTopic(requirement);
  if (!topic) return requirement.key;
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/**
 * Returns NEW section objects with requirement keys / mandatory questions /
 * guidance stamped per the kind policy. Input sections are never mutated.
 * Stamping is cumulative across requirements and idempotent (same inputs →
 * same output).
 */
export function stampPlanSectionsWithRequirements(
  sections: ReadonlyArray<ReportPlanSection>,
  requirements: ReadonlyArray<ReportingRequirement>,
): ReportPlanSection[] {
  const stamped: ReportPlanSection[] = sections.map((s) => ({
    ...s,
    mandatoryQuestions: [...(s.mandatoryQuestions ?? [])],
    evidenceNeeds: [...(s.evidenceNeeds ?? [])],
    requirementKeys: [...(s.requirementKeys ?? [])],
    requirementGuidance: [...(s.requirementGuidance ?? [])],
  }));

  for (const requirement of requirements) {
    const policy = KIND_POLICY[requirement.kind];
    if (!policy) continue;

    const match = matchRequirementToSection(requirement, stamped);
    let index = match.sectionIndex;
    if (index < 0 && policy.fallback !== -1 && stamped.length > 0) {
      index = policy.fallback === -2 ? stamped.length - 1 : 0;
    }
    if (index < 0 || index >= stamped.length) continue;

    const section = stamped[index]!;
    if (policy.stampKeys) pushUnique(section.requirementKeys!, requirement.key);
    if (policy.stampGuidance && requirement.guidance && requirement.guidance.trim()) {
      pushUnique(section.requirementGuidance!, requirement.guidance.trim());
    }
    if (policy.stampQuestion) {
      pushUnique(section.mandatoryQuestions, mandatoryQuestionText(requirement));
    }
  }

  // Sections with no stamps keep clean arrays (never undefined) so consumers
  // may iterate unconditionally; drop the guidance array when empty to keep
  // persisted plans identical to pre-remediation output when unused.
  return stamped.map((s) => {
    if ((s.requirementGuidance ?? []).length === 0) delete s.requirementGuidance;
    if ((s.requirementKeys ?? []).length === 0) delete s.requirementKeys;
    return s;
  });
}

