import type { SectionInputType, TemplateSection } from "../templates/template-section.js";
import type { ReportScope } from "./report-scope.js";

/**
 * Built-in report structure per report type, used whenever the period has no
 * donor template (or the attached template is for a different kind of report).
 * A donor template, when present and applicable, always wins.
 *
 * The blueprints are deliberately generic: they carry no donor-specific wording,
 * only the sections a competent report of that kind contains. Activity and
 * Situation reports are short, factual and never carry a project-wide executive
 * summary; cadence reports follow the usual donor progress-report shape.
 */

export interface BlueprintActivity {
  id: string;
  title: string;
  /** ISO date-only, for the heading. */
  date?: string;
  location?: string;
}

export interface BlueprintInput {
  reportType: string;
  scope: ReportScope;
  /** The activities an ACTIVITY report covers (in date order). */
  activities?: ReadonlyArray<BlueprintActivity>;
}

interface Spec {
  key: string;
  title: string;
  description: string;
  inputType?: SectionInputType;
  required?: boolean;
  instructions?: string;
  questions?: string[];
  tables?: Array<{ title: string; columns: string[] }>;
  evidence?: string[];
  maxWords?: number;
  level?: number;
  parent?: string;
}

const NO_INVENTION =
  "Use only the supplied data; where the data does not cover something, say it was not reported rather than estimating.";

function build(prefix: string, specs: Spec[]): TemplateSection[] {
  return specs.map((sp, i) => ({
    id: `bp:${prefix}:${sp.key}`,
    title: sp.title,
    description: sp.description,
    inputType: sp.inputType ?? "NARRATIVE",
    required: sp.required ?? true,
    evidenceNeeded: sp.evidence ?? [],
    order: i + 1,
    reviewStatus: "REVIEWED" as const,
    ...(sp.maxWords ? { maxWords: sp.maxWords } : {}),
    ...(sp.parent ? { parentId: `bp:${prefix}:${sp.parent}` } : {}),
    level: sp.level ?? 1,
    instructions: sp.instructions ?? sp.description,
    mandatoryQuestions: sp.questions ?? [],
    requiredTables: (sp.tables ?? []).map((t) => ({ title: t.title, columns: [...t.columns] })),
    includeInReport: true,
  }));
}

const PARTICIPANT_COLUMNS = ["Group", "Total", "Male", "Female", "Children", "People with disabilities"];

// ─── cadence reports ────────────────────────────────────────────────────────

const MONTHLY: Spec[] = [
  { key: "overview", title: "This Month at a Glance", description: "A short account of what the project did this month and where it stands.", maxWords: 250 },
  { key: "activities", title: "Activities Implemented", description: "The activities carried out this month, with dates, locations and results.", evidence: ["Activity reports", "Photos", "Attendance sheets"] },
  { key: "indicators", title: "Progress Against Indicators", description: "Indicator results for the month against targets.", inputType: "INDICATOR_TABLE" },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached this month, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }] },
  { key: "challenges", title: "Challenges and Mitigation", description: "Problems met this month and what was done about them." },
  { key: "next", title: "Plan for Next Month", description: "What is planned for the coming month.", maxWords: 250 },
];

const PROGRESS_CORE = (cumulative: boolean): Spec[] => [
  { key: "exec", title: "Executive Summary", description: "The period's headline results, shortfalls and what needs attention.", maxWords: 400 },
  { key: "context", title: "Context and Operating Environment", description: "Changes in the context that affected delivery." },
  { key: "results", title: cumulative ? "Results Against Targets (Period and Cumulative)" : "Progress Against the Results Framework", description: "Indicator results against targets by output and outcome.", inputType: "INDICATOR_TABLE" },
  { key: "activities", title: "Activities Implemented", description: "Key activities delivered in the period and their results." },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached, disaggregated by sex, age and disability.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }] },
  { key: "challenges", title: "Challenges and Adaptations", description: "Challenges faced, how they were handled and what changed." },
  { key: "risks", title: "Risks and Mitigation", description: "Current risks, their status and mitigation measures." },
  { key: "lessons", title: "Lessons Learned", description: "What worked, what did not, and what should change." },
];

const FINANCE: Spec = {
  key: "finance",
  title: "Financial and Procurement Overview",
  description: "Spending and procurement status, if financial data was supplied.",
  required: false,
  instructions: "Only report financial or procurement figures that appear in the supplied data. If none were supplied, state briefly that financial data is reported separately. Never estimate amounts.",
};

const QUARTERLY: Spec[] = [
  ...PROGRESS_CORE(false),
  FINANCE,
  { key: "next", title: "Plan for Next Quarter", description: "Planned activities and priorities for the coming quarter." },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const SEMI_ANNUAL: Spec[] = [
  ...PROGRESS_CORE(true),
  { key: "comparison", title: "Comparison with the Previous Half-Year", description: "How this half-year compares with the previous one: what accelerated, slowed or changed." },
  FINANCE,
  { key: "next", title: "Plan for the Next Half-Year", description: "Planned activities and priorities for the coming half-year." },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const ANNUAL: Spec[] = [
  { key: "exec", title: "Executive Summary", description: "The year's headline results, shortfalls and what needs attention.", maxWords: 500 },
  { key: "context", title: "Context and Operating Environment", description: "How the context evolved over the year and affected delivery." },
  { key: "results", title: "Results by Outcome", description: "Annual results against targets, by outcome and output.", inputType: "INDICATOR_TABLE" },
  { key: "cumulative", title: "Cumulative Progress Against Project Targets", description: "Progress since project start against life-of-project targets." },
  { key: "activities", title: "Key Activities and Achievements", description: "The main activities of the year and what they achieved." },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached over the year, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }] },
  { key: "challenges", title: "Challenges and Adaptations", description: "Challenges faced over the year and how the project adapted." },
  { key: "risks", title: "Risks and Mitigation", description: "Risk status and mitigation measures." },
  FINANCE,
  { key: "sustainability", title: "Sustainability", description: "Steps taken toward lasting results and local ownership.", required: false },
  { key: "lessons", title: "Lessons Learned and Recommendations", description: "Lessons from the year and recommendations for the next." },
  { key: "workplan", title: "Work Plan for Next Year", description: "Planned activities and priorities for the coming year." },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const FINAL: Spec[] = [
  { key: "exec", title: "Executive Summary", description: "What the project set out to do, what it achieved and what remains.", maxWords: 500 },
  { key: "background", title: "Project Background", description: "The problem, the project's objectives and the approach taken." },
  { key: "objectives", title: "Achievement of Objectives", description: "Final results against life-of-project targets.", inputType: "INDICATOR_TABLE" },
  { key: "outcomes", title: "Outcomes and Impact", description: "Changes the project contributed to, with the evidence for them." },
  { key: "activities", title: "Activities Delivered", description: "The main activities delivered over the project's life." },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "Total people reached, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }] },
  { ...FINANCE, key: "finance", title: "Financial Close-out" },
  { key: "sustainability", title: "Sustainability and Exit", description: "What continues after the project, who owns it, and handover arrangements." },
  { key: "lessons", title: "Challenges and Lessons Learned", description: "Challenges over the project's life and the lessons drawn." },
  { key: "recommendations", title: "Recommendations", description: "Recommendations for future programming and partners." },
  { key: "conclusion", title: "Conclusion", description: "A brief closing assessment.", maxWords: 250 },
  { key: "annexes", title: "Annexes", description: "Supporting documents, handover records and evidence.", inputType: "ANNEX", required: false },
];

// ─── ad-hoc reports ─────────────────────────────────────────────────────────

function activityBlueprint(input: BlueprintInput): Spec[] {
  const acts = input.activities ?? [];
  const specs: Spec[] = [
    {
      key: "overview",
      // Not "Overview": the AI worker classes any title containing it as an Executive Summary.
      title: "Introduction",
      description: "What this report covers: the activity or activities, when and where.",
      maxWords: 200,
      instructions: `Introduce the report and the activities it covers (dates, locations, the output or indicator each supports). Do not summarise the wider project. ${NO_INVENTION}`,
    },
    { key: "details", title: "Activity Details", description: "What was done in each activity.", required: true },
  ];
  for (const a of acts) {
    const label = [a.date, a.location].filter(Boolean).join(", ");
    specs.push({
      key: `item:${a.id}`,
      title: a.title,
      description: `Account of the activity "${a.title}"${label ? ` (${label})` : ""}.`,
      level: 2,
      parent: "details",
      maxWords: 400,
      instructions: `Report only on the activity "${a.title}" (activity id ${a.id}). Cover what was implemented, who took part, what was achieved, any challenges and the next steps, using only this activity's record. ${NO_INVENTION}`,
      questions: ["What was implemented?", "Who took part?", "What was achieved?", "What challenges arose?", "What are the next steps?"],
    });
  }
  specs.push(
    {
      key: "participants",
      title: "Participants and Reach",
      description: "Everyone reached across the covered activities, disaggregated.",
      maxWords: 200,
      instructions: `Comment briefly on who was reached across the activities, using the recorded sex, age and disability breakdown. A table of participants per activity is added automatically below your text, so do not write a table yourself. Never infer a breakdown that was not recorded. ${NO_INVENTION}`,
    },
    { key: "challenges", title: "Challenges and Lessons Learned", description: "Challenges across the activities and what was learned.", maxWords: 300 },
    { key: "next", title: "Next Steps", description: "Follow-up actions arising from the activities.", maxWords: 200 },
    {
      key: "annex",
      title: "Evidence Annex",
      description: "The photos, attendance sheets and field reports that support this report.",
      inputType: "ANNEX",
      required: false,
      instructions: "List the evidence files attached to the covered activities, if any. If none are attached, say so in one sentence. There is no donor template for this report; never refer to one.",
    },
  );
  return specs;
}

function situationBlueprint(input: BlueprintInput): Spec[] {
  const followUp = (input.scope.sequence ?? 1) > 1;
  return [
    {
      key: "overview",
      title: "Situation at a Glance",
      description: "The headline of the situation as of the report date.",
      maxWords: 200,
      instructions: `Open with the situation as of the report date in a few plain sentences. This is a situation report, not a project summary. ${NO_INVENTION}`,
    },
    followUp
      ? { key: "changes", title: "Developments Since the Last Report", description: "What has changed since the previous situation report.", maxWords: 300, instructions: `Describe only what changed since the previous report; do not repeat unchanged background. ${NO_INVENTION}` }
      : { key: "background", title: "Background", description: "How the situation arose and the context needed to read this report.", maxWords: 250 },
    { key: "needs", title: "Affected Population and Needs", description: "Who is affected, how many, and what they need.", maxWords: 300, instructions: `State the affected population and needs, with the source of each figure. If the supplied data gives no affected-population figures, say they were not reported; never estimate. ${NO_INVENTION}` },
    { key: "response", title: "Response to Date", description: "What the organisation has done so far and who it reached.", maxWords: 300, evidence: ["Activity reports", "Distribution records"] },
    { key: "constraints", title: "Access, Security and Constraints", description: "What limits access or delivery.", maxWords: 200 },
    { key: "coordination", title: "Coordination", description: "Coordination with authorities, clusters and partners.", maxWords: 150, required: false },
    { key: "priorities", title: "Priority Needs and Next Steps", description: "Gaps still open and what happens next.", maxWords: 250 },
  ];
}

function customBlueprint(input: BlueprintInput): Spec[] {
  const own = input.scope.sections ?? [];
  if (own.length > 0) {
    return own.map((s, i) => ({
      key: `s${i + 1}`,
      title: s.title,
      description: s.guidance ?? `Write the "${s.title}" section of this report.`,
      instructions: s.guidance ? `${s.guidance} ${NO_INVENTION}` : undefined,
    }));
  }
  return [
    { key: "purpose", title: "Background and Purpose", description: input.scope.purpose ?? "Why this report exists and who it is for.", maxWords: 250 },
    { key: "findings", title: "Findings", description: "The main content of the report, grounded in the supplied project data." },
    { key: "conclusions", title: "Conclusions and Next Steps", description: "What follows from the findings.", maxWords: 250 },
  ];
}

const BLUEPRINTS: Record<string, (input: BlueprintInput) => Spec[]> = {
  MONTHLY: () => MONTHLY,
  QUARTERLY: () => QUARTERLY,
  SEMI_ANNUAL: () => SEMI_ANNUAL,
  ANNUAL: () => ANNUAL,
  FINAL: () => FINAL,
  ACTIVITY: activityBlueprint,
  SITUATION: situationBlueprint,
  CUSTOM: customBlueprint,
};

/** Report types whose structure must not come from an unrelated (full-report) donor template. */
const STRICT_TEMPLATE_TYPES: ReadonlySet<string> = new Set(["ACTIVITY", "SITUATION"]);

/**
 * Whether a donor template written for `templateType` may structure a report of
 * `reportType`. Short ad-hoc reports (activity, situation) only accept a template
 * of their own kind; every other combination is the author's choice.
 */
export function templateAppliesToReportType(reportType: string, templateType: string | undefined): boolean {
  if (!STRICT_TEMPLATE_TYPES.has(reportType)) return true;
  return templateType === reportType;
}

/** The built-in section structure for a report type (empty for an unknown type). */
export function blueprintSectionsFor(input: BlueprintInput): TemplateSection[] {
  const make = BLUEPRINTS[input.reportType];
  if (!make) return [];
  return build(input.reportType.toLowerCase(), make(input));
}
