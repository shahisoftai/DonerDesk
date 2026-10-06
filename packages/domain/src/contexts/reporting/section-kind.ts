import { classificationTitle } from "./report-plan.js";

/**
 * What a report section is *for*, read from its title (never the displayed, possibly translated, one). It decides which
 * deterministic writer a fallback uses, so a section nobody planned a stub for gets a narrative from the officer's own
 * records and not a dump of every indicator.
 */
export const SECTION_KINDS = [
  "executive_summary",
  "methodology",
  "results",
  "activities",
  "achievements",
  "challenges",
  "learning",
  "plan",
  "voice",
  "finance",
  "annex",
  "compliance",
  "narrative",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** First match wins; the order keeps "Progress Against the Work Plan" a results section and "Challenges and Lessons" a challenges one. */
const KIND_RULES: ReadonlyArray<{ kind: Exclude<SectionKind, "narrative">; pattern: RegExp }> = [
  { kind: "executive_summary", pattern: /executive summary|abstract|overview|at a glance/ },
  { kind: "methodology", pattern: /methodolog|data quality/ },
  { kind: "results", pattern: /indicator|progress|performance|results|outcome/ },
  { kind: "activities", pattern: /activit/ },
  { kind: "achievements", pattern: /achievement/ },
  { kind: "challenges", pattern: /challenge/ },
  { kind: "learning", pattern: /lesson|learning|adaptation|recommendation/ },
  { kind: "plan", pattern: /next period|next month|next quarter|next half|next year|next steps|priorities|work plan|plan for/ },
  { kind: "voice", pattern: /voice|testimonial|quote/ },
  { kind: "finance", pattern: /financ|budget|expenditure/ },
  { kind: "annex", pattern: /annex/ },
  { kind: "compliance", pattern: /environment|branding|marking|gender|safeguard|coordination|compliance|sustainab|risk|exit/ },
];

export function sectionKindOfTitle(title: string): SectionKind {
  const text = title.toLowerCase();
  return KIND_RULES.find((rule) => rule.pattern.test(text))?.kind ?? "narrative";
}

/** The kind of a plan section, from its classification title. */
export function sectionKind(section: { title: string; canonicalTitle?: string }): SectionKind {
  return sectionKindOfTitle(classificationTitle(section));
}

/**
 * Kinds written from the officer's own words, not from indicator figures: the writer needs a note (or a template
 * question's answer) for them, and a stub must never fill them with indicator values.
 */
export function isRecordsOnlyKind(kind: SectionKind): boolean {
  return kind === "compliance" || kind === "narrative";
}
