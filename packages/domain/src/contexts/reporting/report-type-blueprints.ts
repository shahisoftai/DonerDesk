import type { SectionInputType, TemplateSection } from "../templates/template-section.js";
import type { ReportScope } from "./report-scope.js";
import { translateBlueprintText } from "./report-type-blueprint-i18n.js";

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
  /** Report language (reporting profile); section titles are shown in it. Defaults to English. */
  language?: string;
  /** Verified financial figures exist for the period: the financial section becomes required and reports them. */
  financeAvailable?: boolean;
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

function build(prefix: string, specs: Spec[], language?: string): TemplateSection[] {
  return specs.map((sp, i) => ({
    id: `bp:${prefix}:${sp.key}`,
    // Activity sub-section titles are the user's own words; everything else is translated.
    title: sp.key.startsWith("item:") ? sp.title : translateBlueprintText(sp.title, language),
    canonicalTitle: sp.title,
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

// Writer guidance shared by every cadence report. Each section carries its own
// instructions and a few questions the writer must answer from the supplied data
// ("not recorded" is an acceptable answer; an invented one is not).
const BENEFICIARIES_GUIDANCE = `Comment briefly on who was reached, using the recorded sex, age and disability breakdown. A table is added automatically, so do not write one yourself. Never infer a breakdown that was not recorded. ${NO_INVENTION}`;
const CHALLENGES_GUIDANCE = `Use only challenges and mitigations recorded in activity updates, indicator comments or the officer's story. Group them by theme; name what was done about each. ${NO_INVENTION}`;

const MONTHLY: Spec[] = [
  {
    key: "overview",
    title: "This Month at a Glance",
    description: "A short account of what the project did this month and where it stands.",
    maxWords: 250,
    instructions: `Open with a 3-4 sentence headline of the month: the main activities delivered, the people reached and any result worth flagging. Keep it factual and short; do not summarise the whole project. ${NO_INVENTION}`,
    questions: ["What were the main things delivered this month?", "Is there anything that needs the donor's attention?"],
  },
  {
    key: "activities",
    title: "Activities Implemented",
    description: "The activities carried out this month, with dates, locations and results.",
    evidence: ["Activity reports", "Photos", "Attendance sheets"],
    instructions: `Describe each activity recorded for the month with its date, location and result. Only activities dated inside the month belong here. ${NO_INVENTION}`,
    questions: ["Which activities were carried out, where and when?", "What did they achieve?"],
  },
  {
    key: "indicators",
    title: "Progress Against Indicators",
    description: "Indicator results for the month against targets.",
    inputType: "INDICATOR_TABLE",
    instructions: `Summarise the month's indicator results against targets in a few sentences; the full table is added automatically. Quote values and previous-month values verbatim and name indicators that could not be calculated. ${NO_INVENTION}`,
  },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached this month, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }], instructions: BENEFICIARIES_GUIDANCE },
  {
    key: "challenges",
    title: "Challenges and Mitigation",
    description: "Problems met this month and what was done about them.",
    instructions: CHALLENGES_GUIDANCE,
    questions: ["What challenges arose this month?", "What was done to address them?"],
  },
  {
    key: "next",
    title: "Plan for Next Month",
    description: "What is planned for the coming month.",
    maxWords: 250,
    instructions: `List what is planned for next month using only the recorded next steps and workplan data. ${NO_INVENTION}`,
    questions: ["What is planned for next month?"],
  },
];

const PROGRESS_CORE = (cumulative: boolean): Spec[] => [
  {
    key: "exec",
    title: "Executive Summary",
    description: "The period's headline results, shortfalls and what needs attention.",
    maxWords: 400,
    instructions: `Summarise the period for a reader who will read nothing else: headline results against targets, the main shortfall and what needs attention. ${cumulative ? "Include progress since the project started where cumulative figures exist. " : ""}${NO_INVENTION}`,
  },
  {
    key: "context",
    title: "Context and Operating Environment",
    description: "Changes in the context that affected delivery.",
    instructions: `Describe only context changes recorded in the story, activity updates or indicator comments (access, security, markets, policy, weather) and how they affected delivery. If none were recorded, say so in one sentence. ${NO_INVENTION}`,
    questions: ["What changed in the operating environment, and how did it affect delivery?"],
  },
  {
    key: "results",
    title: cumulative ? "Results Against Targets (Period and Cumulative)" : "Progress Against the Results Framework",
    description: "Indicator results against targets by output and outcome.",
    inputType: "INDICATOR_TABLE",
    instructions: `Comment on progress against targets by output and outcome; the full table is added automatically. Explain material variances (clearly ahead of or behind target) using only recorded explanations. ${cumulative ? "State both this period's result and the cumulative figure. " : ""}${NO_INVENTION}`,
  },
  {
    key: "activities",
    title: "Activities Implemented",
    description: "Key activities delivered in the period and their results.",
    instructions: `Group the period's activities by the output they serve and state what each group achieved, quoting recorded dates, locations and participant numbers. ${NO_INVENTION}`,
    questions: ["Which key activities were delivered, and what did they achieve?"],
  },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached, disaggregated by sex, age and disability.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }], instructions: BENEFICIARIES_GUIDANCE },
  {
    key: "challenges",
    title: "Challenges and Adaptations",
    description: "Challenges faced, how they were handled and what changed.",
    instructions: CHALLENGES_GUIDANCE,
    questions: ["What were the main challenges?", "How did the project adapt?"],
  },
  {
    key: "risks",
    title: "Risks and Mitigation",
    description: "Current risks, their status and mitigation measures.",
    instructions: `Report only risks and mitigation measures recorded in the supplied data. If no risk register entries were supplied, say the risk register is maintained separately; do not invent risks. ${NO_INVENTION}`,
  },
  {
    key: "lessons",
    title: "Lessons Learned",
    description: "What worked, what did not, and what should change.",
    instructions: `Use only lessons recorded in activity updates or the officer's story. Say what worked, what did not and what should change as a result. ${NO_INVENTION}`,
    questions: ["What worked well?", "What should change?"],
  },
];

/** Not "...Overview": the AI worker classes any title containing it as an Executive Summary. */
const FINANCE_TITLE = "Financial and Procurement Status";

const FINANCE_UNAVAILABLE_INSTRUCTIONS =
  "Only report financial or procurement figures that appear in the supplied data. If none were supplied, state briefly that financial data is reported separately. Never estimate amounts.";

const FINANCE_AVAILABLE_INSTRUCTIONS = `Report the verified financial figures supplied (budget, expenditure, committed, balance and burn rate, per budget line where given) exactly as supplied, in the stated currency. A table of them is added automatically below your text, so do not write a table yourself. Say whether spending is in line with the period's recorded progress only if the supplied data supports it, and never estimate or total amounts yourself. ${NO_INVENTION}`;

/** The financial section: optional prose when no figures exist, required and data-driven when verified figures do. */
function financeSpec(input: BlueprintInput, overrides: Partial<Spec> = {}): Spec {
  const available = input.financeAvailable === true;
  return {
    key: "finance",
    title: FINANCE_TITLE,
    description: available ? "Verified budget and expenditure for the period." : "Spending and procurement status, if financial data was supplied.",
    required: available,
    instructions: available ? FINANCE_AVAILABLE_INSTRUCTIONS : FINANCE_UNAVAILABLE_INSTRUCTIONS,
    ...overrides,
  };
}

const QUARTERLY = (input: BlueprintInput): Spec[] => [
  ...PROGRESS_CORE(false),
  financeSpec(input),
  {
    key: "next",
    title: "Plan for Next Quarter",
    description: "Planned activities and priorities for the coming quarter.",
    instructions: `List the planned activities and priorities for the coming quarter from the recorded next steps and workplan. ${NO_INVENTION}`,
    questions: ["What are the priorities for the next quarter?"],
  },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const SEMI_ANNUAL = (input: BlueprintInput): Spec[] => [
  ...PROGRESS_CORE(true),
  {
    key: "comparison",
    title: "Comparison with the Previous Half-Year",
    description: "How this half-year compares with the previous one: what accelerated, slowed or changed.",
    instructions: `Compare with the previous reporting period only where a previous value or previous report text was supplied: quote both values verbatim and say what accelerated, slowed or changed. If no earlier report exists, say this is the first half-year report and compare nothing. ${NO_INVENTION}`,
    questions: ["What accelerated or slowed compared with the previous period?"],
  },
  financeSpec(input),
  {
    key: "next",
    title: "Plan for the Next Half-Year",
    description: "Planned activities and priorities for the coming half-year.",
    instructions: `List the planned activities and priorities for the coming half-year from the recorded next steps and workplan. ${NO_INVENTION}`,
    questions: ["What are the priorities for the next half-year?"],
  },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const ANNUAL = (input: BlueprintInput): Spec[] => [
  {
    key: "exec",
    title: "Executive Summary",
    description: "The year's headline results, shortfalls and what needs attention.",
    maxWords: 500,
    instructions: `Summarise the year for a reader who will read nothing else: headline annual results, progress since the project started, the main shortfall and what needs attention. ${NO_INVENTION}`,
  },
  {
    key: "context",
    title: "Context and Operating Environment",
    description: "How the context evolved over the year and affected delivery.",
    instructions: `Describe only context changes recorded in the story, activity updates or indicator comments and how they affected delivery over the year. ${NO_INVENTION}`,
    questions: ["How did the operating environment change over the year?"],
  },
  {
    key: "results",
    title: "Results by Outcome",
    description: "Annual results against targets, by outcome and output.",
    inputType: "INDICATOR_TABLE",
    instructions: `Comment on the year's results by outcome and output; the full table is added automatically. Explain material variances using only recorded explanations. ${NO_INVENTION}`,
  },
  {
    key: "cumulative",
    title: "Cumulative Progress Against Project Targets",
    description: "Progress since project start against life-of-project targets.",
    instructions: `Report progress since the project started against each life-of-project target, from the cumulative figures supplied; a table is added automatically. Say whether the project is on track only where the data permits evaluative wording, and name indicators with no cumulative figure. ${NO_INVENTION}`,
    questions: ["How far has the project progressed against its life-of-project targets?"],
  },
  {
    key: "activities",
    title: "Key Activities and Achievements",
    description: "The main activities of the year and what they achieved.",
    instructions: `Group the year's main activities by the output they serve and state what each group achieved. ${NO_INVENTION}`,
    questions: ["What were the main activities of the year, and what did they achieve?"],
  },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "People reached over the year, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }], instructions: BENEFICIARIES_GUIDANCE },
  {
    key: "challenges",
    title: "Challenges and Adaptations",
    description: "Challenges faced over the year and how the project adapted.",
    instructions: CHALLENGES_GUIDANCE,
    questions: ["What were the main challenges of the year?", "How did the project adapt?"],
  },
  {
    key: "risks",
    title: "Risks and Mitigation",
    description: "Risk status and mitigation measures.",
    instructions: `Report only risks and mitigation measures recorded in the supplied data; do not invent risks. ${NO_INVENTION}`,
  },
  financeSpec(input),
  {
    key: "sustainability",
    title: "Sustainability",
    description: "Steps taken toward lasting results and local ownership.",
    required: false,
    instructions: `Describe only recorded steps toward lasting results (capacity building, handover, local ownership, partnerships). If none were recorded, say so in one sentence. ${NO_INVENTION}`,
  },
  {
    key: "lessons",
    title: "Lessons Learned and Recommendations",
    description: "Lessons from the year and recommendations for the next.",
    instructions: `Use only lessons recorded in activity updates or the officer's story; recommendations must follow directly from a recorded lesson or challenge. ${NO_INVENTION}`,
    questions: ["What did the year teach?", "What should change next year?"],
  },
  {
    key: "workplan",
    title: "Work Plan for Next Year",
    description: "Planned activities and priorities for the coming year.",
    instructions: `List planned activities and priorities for the coming year from the recorded next steps and workplan. ${NO_INVENTION}`,
    questions: ["What are the priorities for next year?"],
  },
  { key: "annexes", title: "Annexes", description: "Supporting documents and evidence referenced in the report.", inputType: "ANNEX", required: false },
];

const FINAL = (input: BlueprintInput): Spec[] => [
  {
    key: "exec",
    title: "Executive Summary",
    description: "What the project set out to do, what it achieved and what remains.",
    maxWords: 500,
    instructions: `Summarise the whole project for a reader who will read nothing else: what it set out to do, what it achieved against life-of-project targets, what fell short and what remains. ${NO_INVENTION}`,
  },
  {
    key: "background",
    title: "Project Background",
    description: "The problem, the project's objectives and the approach taken.",
    instructions: `Describe the problem, the objectives and the approach from the project description, logframe and officer's story only. ${NO_INVENTION}`,
    questions: ["What problem did the project address?", "What approach did it take?"],
  },
  {
    key: "objectives",
    title: "Achievement of Objectives",
    description: "Final results against life-of-project targets.",
    inputType: "INDICATOR_TABLE",
    instructions: `State final results against each life-of-project target using the cumulative figures supplied; the full table is added automatically. Name targets met, targets missed and indicators with no cumulative figure. Explain shortfalls only with recorded explanations. ${NO_INVENTION}`,
  },
  {
    key: "outcomes",
    title: "Outcomes and Impact",
    description: "Changes the project contributed to, with the evidence for them.",
    instructions: `Distinguish outputs (what was delivered) from outcomes (what changed). Claim an outcome only where an indicator result, evidence or recorded observation supports it, and cite it. ${NO_INVENTION}`,
    questions: ["What changed for the people the project served?", "What evidence supports it?"],
  },
  {
    key: "activities",
    title: "Activities Delivered",
    description: "The main activities delivered over the project's life.",
    instructions: `Describe the main activities delivered over the project's life, grouped by output, from the activity records supplied (they cover the whole project, not only the last period). ${NO_INVENTION}`,
    questions: ["Which main activities were delivered over the project's life?"],
  },
  { key: "beneficiaries", title: "Beneficiaries Reached", description: "Total people reached, disaggregated.", tables: [{ title: "Beneficiaries reached", columns: PARTICIPANT_COLUMNS }], instructions: BENEFICIARIES_GUIDANCE },
  financeSpec(input, { title: "Financial Close-out", description: input.financeAvailable ? "Verified final budget and expenditure." : "Final spending and procurement status, if financial data was supplied." }),
  {
    key: "sustainability",
    title: "Sustainability and Exit",
    description: "What continues after the project, who owns it, and handover arrangements.",
    instructions: `Describe what continues after the project, who owns it and the handover arrangements, using only recorded information. If handover is not recorded, say so. ${NO_INVENTION}`,
    questions: ["What continues after the project, and who owns it?"],
  },
  {
    key: "lessons",
    title: "Challenges and Lessons Learned",
    description: "Challenges over the project's life and the lessons drawn.",
    instructions: CHALLENGES_GUIDANCE,
    questions: ["What were the main challenges over the project's life?", "What lessons were drawn?"],
  },
  {
    key: "recommendations",
    title: "Recommendations",
    description: "Recommendations for future programming and partners.",
    instructions: `Give recommendations that follow directly from a recorded lesson or challenge; name who each is for only if the data says so. ${NO_INVENTION}`,
    questions: ["What should future programming do differently?"],
  },
  { key: "conclusion", title: "Conclusion", description: "A brief closing assessment.", maxWords: 250, instructions: `Close with a brief assessment of the project as a whole, consistent with the sections above. ${NO_INVENTION}` },
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
    { key: "needs", title: "Affected Population and Needs", description: "Who is affected, how many, and what they need.", maxWords: 300, instructions: `State the affected population and needs, with the source of each figure. When the author entered figures, a table of them is added automatically below your text: do not write a table yourself, and quote each figure exactly as entered (with the previous report's figure for comparison when one is given). If the supplied data gives no affected-population figures, say they were not reported; never estimate. ${NO_INVENTION}` },
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
  QUARTERLY,
  SEMI_ANNUAL,
  ANNUAL,
  FINAL,
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
  return build(input.reportType.toLowerCase(), make(input), input.language);
}
