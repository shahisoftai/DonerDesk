import type {
  IReportDraftGenerator,
  GenerateReportDraftInput,
  GeneratedDraftResult,
  GeneratedSection,
  GeneratedSectionResult,
  ReportClaimDraft,
  ILLMProvider,
  LlmGeneratorModelInfo,
  ILogger,
} from "@donordesk/application";
import type { ReportPlanSection, SourceReference, ClaimType } from "@donordesk/domain";
import { isSynthesisSection, visibilityPromptBlock } from "@donordesk/domain";
import { StubReportDraftGenerator } from "./report-draft-generator.js";
import { createHash } from "node:crypto";

interface LlmRewriteSectionInput {
  sectionTitle: string;
  content: string;
  mode: "REWRITE" | "SHORTEN";
  audience: "DONOR" | "INTERNAL" | "GENERAL";
  instructions?: string;
  sourceReferences: SourceReference[];
}

const CLAIM_TYPES = new Set<ClaimType>(["NUMERIC", "FACTUAL", "CAUSAL", "QUALITATIVE"]);
const REFERENCE_TYPES = new Set<SourceReference["type"]>(["evidence", "activity", "indicator", "template"]);

/**
 * Language-craft rules (quality remediation WS2). Exported for deterministic
 * tests; mirrored conceptually by the AI Reporter writer contract v3.
 */
export const LANGUAGE_CRAFT_RULES: readonly string[] = [
  `Write in the active voice and name the actor ("The project trained 30 volunteers"), never the passive ("30 volunteers were trained").`,
  `Prefer plain, concrete words over bureaucratic vocabulary; no filler ("it is worth noting", "in order to").`,
  `Front-load each sentence: state the outcome and its number first, context after.`,
  `Keep one idea per sentence; keep sentences under about 25 words.`,
  `Open sections with the result ("School attendance rose..."), never with a topic label ("Regarding education...").`,
  `Never use the future tense for completed work; never use the present tense for finished delivery.`,
];

export function buildSystemPrompt(): string {
  return [
    "You are a precise donor report narrator.",
    "You MUST only describe data that appears verbatim in the provided verified findings or evidence.",
    "You MUST NOT compute, aggregate, extrapolate, or infer any numbers not present in the input.",
    "You MUST NOT invent causes, challenges, mitigations, lessons, future activities, targets, dates, partners, incidents, or outcomes.",
    "A document title is only inventory metadata; it does not support claims about the document's contents.",
    "A null value with valueStatus NOT_CALCULABLE means unknown, never zero.",
    "You MUST NOT use evaluative language (positive/negative) for indicators with unresolved semantics.",
    "You may only use evaluative wording (favourable/unfavourable) when the finding's performanceEvaluation permits it.",
    "Language craft (mandatory):",
    ...LANGUAGE_CRAFT_RULES.map((r) => `- ${r}`),
    "Output STRICT JSON matching the schema below. No markdown fences, no extra text.",
    "JSON schema:",
    `{`,
    `  "sections": [`,
    `    {`,
    `      "title": "string",`,
    `      "content": "string (narrative or markdown)",`,
    `      "claims": [`,
    `        {`,
    `          "text": "string",`,
    `          "type": "NUMERIC|FACTUAL|CAUSAL|QUALITATIVE",`,
    `          "proposedSources": [{ "evidenceId": "string", "chunkId": "string", "sourceText": "string" }]`,
    `        }`,
    `      ]`,
    `      "sourceReferences": [{ "type": "indicator|evidence|activity", "id": "string", "label": "string" }]`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `Worked example (a narrator would produce this section for an executive summary):`,
    `{`,
    `  "sections": [`,
    `    {`,
    `      "title": "Executive Summary",`,
    `      "content": "During the reporting period the project delivered 30 training sessions reaching 850 beneficiaries (IND-001). IND-002 (Beneficiaries trained) reached 85% of its target of 1,000, up from 500 in the previous period. No significant challenges were recorded.",`,
    `      "claims": [`,
    `        { "text": "850 beneficiaries were trained during the period", "type": "NUMERIC", "proposedSources": [{ "evidenceId": "ev-1", "chunkId": "ev-1:0", "sourceText": "Attendance register" }] }`,
    `      ],`,
    `      "sourceReferences": [`,
    `        { "type": "indicator", "id": "ind-1", "label": "IND-001" },`,
    `        { "type": "activity", "id": "act-1", "label": "Training session" },`,
    `        { "type": "evidence", "id": "ev-1", "label": "Attendance register" }`,
    `      ]`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `Note: the example narrative is illustrative; only write what the provided verified findings, indicator updates, and evidence actually support.`,
  ].join("\n");
}

function toneInstructionFor(profile: GenerateReportDraftInput["reportingProfileSnapshot"]): string {
  return profile.tone === "FORMAL"
    ? "Use formal, professional donor-reporting language."
    : profile.tone === "CONCISE"
      ? "Be concise and to the point."
      : profile.tone === "NARRATIVE"
        ? "Write in a flowing narrative style."
        : "Use technical language appropriate for a donor audience.";
}

function buildProjectBlock(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  if (!ctx?.project) return [];
  return [
    `# Project Context`,
    `- Project: ${ctx.project.title} (${ctx.project.projectCode})`,
    `- Donor: ${ctx.project.donorName}`,
    `- Implementing Organization: ${ctx.project.implementingOrganization}`,
    ctx.project.partnerOrganization ? `- Partner Organization: ${ctx.project.partnerOrganization}` : null,
    `- Country: ${ctx.project.country}`,
    [ctx.project.region, ctx.project.district].filter(Boolean).join(", ")
      ? `- Location: ${[ctx.project.region, ctx.project.district].filter(Boolean).join(", ")}`
      : null,
    `- Sector: ${ctx.project.sector}`,
    `- Project Duration: ${ctx.project.startDate} to ${ctx.project.endDate}`,
    ctx.project.description ? `- Project Description: ${ctx.project.description}` : null,
    ctx.project.budgetAmount !== undefined && ctx.project.budgetAmount !== null
      ? `- Budget: ${ctx.project.budgetAmount} ${ctx.project.budgetCurrency ?? "USD"}`
      : null,
    `- Reporting Frequency: ${ctx.project.reportingFrequency}`,
    ``,
  ].filter(Boolean) as string[];
}

function buildPeriodBlock(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  if (!ctx?.period) return [];
  return [
    `# Reporting Period`,
    `- Report Type: ${ctx.period.reportType}`,
    ctx.period.scope ? `- Report Scope: ${ctx.period.scope}` : null,
    `- Period: ${ctx.period.startDate} to ${ctx.period.endDate}`,
    ctx.period.deadline ? `- Submission Deadline: ${ctx.period.deadline}` : null,
    ctx.period.internalReviewDeadline ? `- Internal Review Deadline: ${ctx.period.internalReviewDeadline}` : null,
    ctx.period.readinessScore !== undefined && ctx.period.readinessScore !== null
      ? `- Readiness Score: ${ctx.period.readinessScore}/100`
      : null,
    ``,
  ].filter(Boolean) as string[];
}

function templateList(title: string, items: string[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  return [`- ${title}:`, ...items.map((i) => `  - ${i}`)];
}

export function buildTemplateBlock(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  return ctx?.template ? renderTemplateBlock(ctx.template) : [];
}

/** The "# Donor Template" prompt block for one template generation context. */
export function renderTemplateBlock(template: NonNullable<NonNullable<GenerateReportDraftInput["reportContext"]>["template"]>): string[] {
  return [
    `# Donor Template`,
    `- Template: ${template.templateName} (v${template.version})`,
    `- Donor: ${template.donorName}`,
    `- Template Language: ${template.language}`,
    template.requiredAnnexes.length > 0 ? `- Required Annexes: ${template.requiredAnnexes.join(", ")}` : null,
    template.notes ? `- Template Notes: ${template.notes}` : null,
    template.reportTitle ? `- Report Title (as required by the donor): ${template.reportTitle}` : null,
    ...templateList("Donor's report-wide instructions (MUST be honoured)", template.generalInstructions),
    ...templateList("Donor formatting rules", template.formattingRules),
    ...templateList("Donor submission instructions (for awareness)", template.submissionInstructions),
    ...templateList("Donor compliance requirements (the report must not contradict these)", template.complianceRequirements),
    ...templateList("Donor indicator reporting requirements", template.indicatorRequirements),
    ``,
  ].filter(Boolean) as string[];
}

/**
 * P0-Increment2 — The "Tell the Story" narrative context, surfaced to the
 * narrator as structured input. This is the information indicators and evidence
 * alone cannot explain (why a target was missed, what changed, lessons). The
 * narrator may weave it into the relevant sections but must never invent new
 * context beyond what is written here.
 */
function buildStoryContextBlock(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  const story = ctx?.storyContext;
  if (!story) return [];
  const rows: string[] = [`# Tell the Story (narrative context provided by the reporting officer)`];
  const labels: Record<string, string> = {
    achievements: "What went well",
    challenges: "What challenges were faced",
    varianceExplanations: "Why targets were over/under achieved",
    adaptations: "What changed or was adapted",
    lessons: "Lessons and notable observations",
  };
  let any = false;
  for (const [key, label] of Object.entries(labels)) {
    const value = story[key as keyof typeof story];
    if (value && value.trim()) {
      rows.push(`- ${label}: ${value.trim()}`);
      any = true;
    }
  }
  if (!any) return [];
  rows.push("", "Use this context to explain performance and enrich the narrative. Only reference what is written here; never invent additional causes, challenges, or lessons.");
  return rows;
}

/**
 * WS3: attribution/visibility prompt lines for the report's donor. Uses the
 * pure domain catalog so wording is exact and donor-keyed. Empty when the
 * donor is unknown (no fabricated attributions).
 */
function buildVisibilityLines(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  const donorName = ctx?.template?.donorName ?? ctx?.project?.donorName;
  if (!donorName) return [];
  return visibilityPromptBlock(donorName, ctx?.project?.implementingOrganization);
}

/**
 * WS1: renders the donor requirement guidance stamped on the plan section by
 * the planner, plus the mandatory-question answering rule. Pure and exported
 * for deterministic tests. Empty when the section carries no stamps.
 */
export function buildRequirementGuidanceBlock(
  section: Pick<ReportPlanSection, "requirementGuidance" | "mandatoryQuestions">,
): string[] {
  const guidance = section.requirementGuidance ?? [];
  const questions = section.mandatoryQuestions ?? [];
  if (guidance.length === 0 && questions.length === 0) return [];
  const lines: string[] = [`# Donor Requirement Guidance (mandatory)`];
  for (const g of guidance) lines.push(`- ${g}`);
  if (questions.length > 0) {
    lines.push(`- Answer every mandatory question explicitly in this section's prose, one short paragraph per question, in order:`);
    for (const q of questions) lines.push(`  * ${q}`);
    lines.push(`- If a mandatory question cannot be answered from the recorded data, state exactly what was not recorded; never guess.`);
  }
  lines.push(``);
  return lines;
}

function buildFindingsJson(input: GenerateReportDraftInput): string {
  return JSON.stringify(
    input.verifiedFindings.map((f) => ({
      indicatorId: f.indicatorId,
      indicatorCode: f.indicatorCode,
      indicatorName: f.indicatorName ?? null,
      indicatorType: f.indicatorType ?? null,
      baseline: f.baseline ?? null,
      target: f.target ?? null,
      // A calculator placeholder of zero must not become a factual "0%"
      // claim when the denominator is absent. Preserve the quality flag and
      // expose the value as unknown to the narrator.
      value: f.qualityFlags.includes("MISSING_DENOMINATOR") ? null : f.value,
      valueStatus: f.qualityFlags.includes("MISSING_DENOMINATOR") ? "NOT_CALCULABLE" : "KNOWN",
      unit: f.unit ?? null,
      calculationMethod: f.calculationMethod,
      semantics: f.semantics
        ? {
            aggregation: f.semantics.aggregation,
            direction: f.semantics.direction,
            reportingBasis: f.semantics.reportingBasis,
            status: f.semantics.status,
          }
        : null,
      comparisonValue: f.comparisonValue ?? null,
      performanceEvaluation: f.performanceEvaluation ?? null,
      qualityFlags: f.qualityFlags,
      reportingPeriodId: f.reportingPeriodId,
      comparisonPeriodId: f.comparisonPeriodId ?? null,
    })),
    null,
  );
}

function buildEvidenceJson(
  input: GenerateReportDraftInput,
  limits?: { maxPackages?: number; maxChunksPerPackage?: number; maxCharsPerChunk?: number },
  section?: ReportPlanSection,
): string {
  const maxPackages = limits?.maxPackages ?? Infinity;
  const maxChunksPerPackage = limits?.maxChunksPerPackage ?? 8;
  const maxCharsPerChunk = limits?.maxCharsPerChunk ?? 800;
  const activityEvidenceIds = new Set(input.activities.flatMap((a) => a.attachedEvidenceIds));
  const indicatorEvidenceIds = new Set(input.indicatorUpdates.flatMap((u) => u.attachedEvidenceIds));
  const sectionText = [
    section?.title ?? "",
    ...(section?.evidenceNeeds ?? []),
    ...(section?.requirementGuidance ?? []),
    ...(section?.mandatoryQuestions ?? []),
    section?.relatedLogframeElement ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const wantsActivities = /activit|challenge|mitigation|lesson|next period|work plan/.test(sectionText);
  const wantsIndicators = /indicator|result|progress|performance|executive|overview/.test(sectionText);
  const keywords = sectionText.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
  const ranked = input.evidencePackages
    .map((p, index) => {
      let score = 0;
      if (wantsActivities && activityEvidenceIds.has(p.evidenceId)) score += 10;
      if (wantsIndicators && indicatorEvidenceIds.has(p.evidenceId)) score += 10;
      // Rank on what the file says, not only its title: the chunk text is
      // what the narrator will actually read and cite.
      const searchable = `${p.title} ${p.evidenceType} ${p.chunks.map((c) => c.text).join(" ").slice(0, 4000)}`.toLowerCase();
      score += keywords.filter((word) => searchable.includes(word)).length;
      if (p.verificationStatus === "VERIFIED") score += 2;
      return { p, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxPackages)
    .map(({ p }) => p);
  return JSON.stringify(
    ranked.map((p) => ({
      evidenceId: p.evidenceId,
      title: p.title,
      evidenceType: p.evidenceType,
      verificationStatus: p.verificationStatus,
      confidentialityLevel: p.confidentialityLevel,
      chunks: p.chunks.slice(0, maxChunksPerPackage).map((c) => ({ chunkId: c.chunkId, text: c.text.slice(0, maxCharsPerChunk) })),
    })),
    null,
  );
}

function buildActivitiesJson(input: GenerateReportDraftInput, limits?: { maxActivities?: number; maxCharsPerField?: number }): string {
  const maxActivities = limits?.maxActivities ?? Infinity;
  const maxCharsPerField = limits?.maxCharsPerField ?? Infinity;
  const truncate = (s: string | undefined): string | null => {
    if (!s) return null;
    return s.length > maxCharsPerField ? `${s.slice(0, maxCharsPerField)}…` : s;
  };
  return JSON.stringify(
    input.activities.slice(0, maxActivities).map((a) => ({
      activityId: a.activityId,
      activityTitle: a.activityTitle,
      activityDate: a.activityDate.toISOString().slice(0, 10),
      location: a.location ?? null,
      participantsTotal: a.participantsTotal ?? null,
      participantsMale: a.participantsMale ?? null,
      participantsFemale: a.participantsFemale ?? null,
      participantsChildren: a.participantsChildren ?? null,
      participantsDisability: a.participantsDisability ?? null,
      summary: truncate(a.summary),
      achievements: truncate(a.achievements),
      challenges: truncate(a.challenges),
      lessonsLearned: truncate(a.lessonsLearned),
      nextSteps: truncate(a.nextSteps),
      attachedEvidenceIds: a.attachedEvidenceIds,
      status: a.status,
    })),
    null,
  );
}

function buildIndicatorUpdatesJson(input: GenerateReportDraftInput): string {
  return JSON.stringify(
    input.indicatorUpdates.map((u) => ({
      indicatorId: u.indicatorId,
      indicatorCode: u.indicatorCode,
      periodAchievement: u.periodAchievement,
      cumulativeAchievement: u.cumulativeAchievement,
      comments: u.comments ?? null,
      dataSource: u.dataSource ?? null,
      attachedEvidenceIds: u.attachedEvidenceIds,
      verificationStatus: u.verificationStatus,
    })),
    null,
  );
}

export function buildSectionGuidance(s: ReportPlanSection): string {
  const parts: string[] = [`Input type: ${s.inputType ?? "NARRATIVE"}`];
  if (s.wordLimit?.min !== undefined) parts.push(`min ${s.wordLimit.min} words`);
  if (s.wordLimit?.max !== undefined) parts.push(`max ${s.wordLimit.max} words`);
  const lines = [`- ${s.title} (${parts.join(", ")})`];
  if (s.mandatoryQuestions && s.mandatoryQuestions.length > 0) {
    lines.push(`  Mandatory questions: ${s.mandatoryQuestions.join("; ")}`);
  }
  if (s.evidenceNeeds && s.evidenceNeeds.length > 0) {
    lines.push(`  Evidence needs: ${s.evidenceNeeds.join("; ")}`);
  }
  if (s.relatedLogframeElement) {
    lines.push(`  Related logframe element: ${s.relatedLogframeElement}`);
  }
  if (s.pageLimit !== undefined) lines.push(`  Page limit set by the donor: ${s.pageLimit}`);
  if (s.donorInstructions?.trim()) {
    lines.push(`  Donor instructions (from the donor's template; follow them, never invent facts to satisfy them):`);
    lines.push(...s.donorInstructions.trim().split("\n").map((l) => `    ${l}`));
  }
  if (s.requiredTables && s.requiredTables.length > 0) {
    lines.push(`  Tables the donor requires (markdown, exactly these columns; cells only from the inputs, 'Not reported' otherwise):`);
    lines.push(...s.requiredTables.map((t) => `    - ${t.title}: | ${t.columns.join(" | ")} |${t.notes ? ` (${t.notes})` : ""}`));
  }
  if (s.authorInstructions?.trim()) {
    lines.push(`  Organisation guidance: ${s.authorInstructions.trim()}`);
  }
  return lines.join("\n");
}

function buildInstructionTail(): string[] {
  return [
    `Use the Project Context, Reporting Period, and Donor Template blocks to frame the report correctly.`,
    `Narrative MUST draw on the activity records and indicator updates provided, and MUST cite evidence:`,
    `- Use activity titles, dates, locations and participant counts (including disaggregation) from the Activity Records.`,
    `- Use recorded achievements, challenges, lessons learned and next steps verbatim from activity updates.`,
    `- If the relevant activity field is absent, state that no verified information was recorded; do not infer it from indicator gaps.`,
    `- Future commitments and numeric targets may only come from an explicit recorded next step or supplied work plan. If none is supplied, state that the approved next-period plan was not available.`,
    `- Use indicator comments and data sources from the Indicator Updates as context.`,
    `- Describe each indicator by its name and code. When a target exists, describe progress toward the target in words without quoting the target figure as a number.`,
    `- When a comparisonValue exists, describe the period-on-period change using only the values provided (e.g. "up from 500 in the previous period").`,
    `- When valueStatus is NOT_CALCULABLE or MISSING_DENOMINATOR is present, say the result could not be calculated because the denominator was unavailable. Never write it as zero.`,
    `Number discipline (mandatory):`,
    `- Quote every figure exactly as given in the Verified Findings block, which is authoritative. Never invent, extrapolate, or round a number yourself.`,
    `- A progress percentage may ONLY be quoted when that specific finding records a calculable value AND a target or baseline. NEVER write a percentage for a finding whose valueStatus is NOT_CALCULABLE or that carries MISSING_DENOMINATOR: the denominator does not exist, so no percentage exists.`,
    `- Do not add incidental numbers: no dates, years, word counts, or time spans such as "6 months".`,
    `- Never quote a figure that appears in no verified finding, indicator update, or activity record: the report-level consistency check blocks approval for any number that is not backed by the recorded data, and a reviewer note cannot clear it — only correcting the text can.`,
    `- Keep every count consistent across sections: the same quantity (e.g. number of centres, volunteers trained) must carry the same value everywhere it appears.`,
    `- When a finding has value null (NOT_CALCULABLE), the result could not be calculated; do not substitute the periodAchievement value from the Indicator Updates block.`,
    `- Evidence titles prove only that a file is present. Do not claim that a file establishes a cause, finding, action, or result unless an evidence chunk contains that statement.`,
    `Claims must reference evidence by evidenceId and chunkId from the evidence packages above.`,
    `Every section MUST list its source references: indicators, evidence files, and activities actually used.`,
    `Honour the per-section input type: INDICATOR_TABLE sections must be tables, ANNEX sections must list annexed files, COMPLIANCE sections must state compliance status against the template requirements.`,
    `Quality of prose (mandatory):`,
    `- Write flowing professional prose for narrative sections; use bullet lists only for genuine enumerations, never as a substitute for synthesis.`,
    `- If a data category was not recorded, write exactly one honest sentence saying so (e.g. "No beneficiary testimonies were recorded in the evidence for this period.") and stop. Do not pad, do not speculate, do not repeat the gap.`,
    `- Do not describe the reporting process, the platform, or the AI; describe the project.`,
    `Performance evaluation guidance (from verified findings):`,
    `- When performanceEvaluation.type is POSITIVE, you may describe the outcome favourably while remaining factual.`,
    `- When performanceEvaluation.type is NEGATIVE, you may describe the outcome as below expectation while remaining factual.`,
    `- When performanceEvaluation.type is NEUTRAL or absent, use strictly descriptive language with no positive or negative judgement.`,
    `Quality flags on findings should be noted as caveats in the narrative:`,
    `- LOW_COVERAGE: use qualifying language such as "based on partial records" or "preliminary data".`,
    `- MISSING_DENOMINATOR: note that the denominator could not be established.`,
    `- MISSING_DISAGGREGATION: note that disaggregated data was not recorded.`,
    `- STALE: note that the underlying records predate the reporting period.`,
    `- UNIT_MISMATCH: note inconsistent units across source records.`,
    `- NEEDS_REVIEW: flag the item as requiring verification before finalization.`,
    `Return only JSON conforming to the schema. No preamble, no commentary.`,
  ];
}

function buildNarratorUserPrompt(input: GenerateReportDraftInput): string {
  const profile = input.reportingProfileSnapshot;
  const toneInstruction = toneInstructionFor(profile);

  const sections = input.reportPlan.sections
    .map((s) => `- ${s.title}`)
    .join("\n");

  const ctx = input.reportContext;
  const projectBlock = buildProjectBlock(ctx);
  const periodBlock = buildPeriodBlock(ctx);
  const templateBlock = buildTemplateBlock(ctx);
  const findingsJson = buildFindingsJson(input);
  const evidenceJson = buildEvidenceJson(input);
  const activitiesJson = buildActivitiesJson(input);
  const indicatorUpdatesJson = buildIndicatorUpdatesJson(input);

  const sectionGuidance = input.reportPlan.sections.map((s) => buildSectionGuidance(s)).join("\n");
  const formattingRules = (profile.formattingRules ?? []).filter(Boolean);

  return [
    `# Report Drafting Request`,
    `# Required sections: ${input.reportPlan.sections.length}`,
    `${sections}`,
    ``,
    `# Tone: ${toneInstruction}`,
    `# Language: ${profile.language}`,
    ...(formattingRules.length > 0 ? [``, `# Formatting Rules`, ...formattingRules.map((r) => `- ${r}`)] : []),
    ``,
    ...projectBlock,
    ...periodBlock,
    ...templateBlock,
    ...buildVisibilityLines(ctx),
    ...buildStoryContextBlock(ctx),
    `# Section Guidance`,
    sectionGuidance,
    ``,
    `# Report Plan`,
    JSON.stringify(input.reportPlan, null, 2),
    ``,
    `# Verified Findings`,
    findingsJson,
    ``,
    `# Indicator Updates`,
    indicatorUpdatesJson,
    ``,
    `# Activity Records`,
    activitiesJson,
    ``,
    `# Evidence Packages`,
    evidenceJson,
    ``,
    `# Instructions`,
    `Draft all sections. For each section, produce narrative content and structured claims.`,
    ...buildInstructionTail(),
  ].join("\n");
}

/**
 * Per-section craft guidance mirroring the deterministic stub builders.
 * Keeps the LLM narrator aligned with the quality bar: synthesized exec
 * summary, no duplicated full indicator tables, period-scoped activities,
 * and honest one-sentence empty states.
 *
 * WS4 adds cross-cutting (protection/gender/AAP/environment) and financial
 * narrative discipline. Exported pure for deterministic tests.
 */
export function buildSectionSpecificGuidance(section: ReportPlanSection, input: GenerateReportDraftInput): string[] {

  const title = section.title.toLowerCase();
  const guidance: string[] = [];
  const period = input.reportContext?.period;
  if (title.includes("executive summary")) {
    guidance.push(
      "Write 2-3 flowing paragraphs (target 180-260 words). NO bullet lists, NO tables, NO headings.",
      "Paragraph 1 - one sentence of project context (project, location, implementer, donor from the context blocks) followed by the delivery snapshot: how many activity records and verified indicator results the period produced (quote the counts only from the context data).",
      "Paragraph 2 - performance synthesis: name the strongest verified results and any below-expectation results, quoting values, targets, and previous-period values verbatim. Name any indicators that could not be calculated instead of guessing percentages.",
      "Paragraph 3 - delivery: total participants engaged across recorded activities if counts exist; one recorded challenge (verbatim from activity updates); and a one-sentence outlook drawn from recorded next steps.",
      "Every number must come from the provided findings, updates, or activity records.",
    );
  }
  if (title.includes("indicator")) {
    guidance.push(
      "Do NOT reproduce the full indicator table - it already exists in Annex A. Write a short narrative synthesis and, if helpful, a SMALL highlights table of at most 6 rows (columns: Code, Indicator, This period, Previous, Direction).",
      "For any finding flagged MISSING_DENOMINATOR, state that the result could not be calculated; never present it as a number or percentage.",
    );
  }
  // "annex" alone matches every annex section (A, B, C, ...); the indicator
  // table instructions below are wrong for a non-indicator annex (evidence
  // checklist, activity log, etc.) — match on what the annex actually is,
  // not on the word "annex".
  if (title.includes("annex") && /(indicator|performance)/.test(title)) {
    guidance.push(
      "Produce ONE full markdown table of all findings with columns: Code, Indicator, Unit, Baseline, Target, This period, Previous, % of target, RAG, Data source.",
      "RAG is derived only from performanceEvaluation (POSITIVE=GREEN, NEGATIVE=RED, NEUTRAL=AMBER; MISSING_DENOMINATOR=GREY). Use the recorded dataSource per indicator update; write 'Project records' when absent.",
      "Follow the table with a short 'Data quality notes' list naming indicators that could not be calculated, had partial records, or lack disaggregation.",
      "Output the table as literal markdown: a header row, a `---` separator row, and one data row per indicator, using `|` cell delimiters. Do not describe the table in prose instead of producing it.",
    );
  } else if (title.includes("annex") && /(evidence|document|file)/.test(title)) {
    guidance.push(
      "List the verified evidence files as a markdown table with columns: File, Type, Verification status, Confidentiality.",
      "Do NOT produce an indicator findings table here — that belongs in the indicator performance annex. This annex lists evidence files, not indicator values.",
      "Follow the table with one short paragraph naming any donor-required annex documents (from the template's required annexes list) that have no matching evidence file.",
    );
  } else if (title.includes("annex")) {
    guidance.push(
      "This annex's content type is not an indicator table or an evidence checklist — follow the section's mandatory questions and input type literally rather than defaulting to a findings table.",
    );
  }
  if (title.includes("activit") && period) {
    guidance.push(
      `Only describe activity records dated within the reporting period ${period.startDate.slice(0, 10)} to ${period.endDate.slice(0, 10)} as this period's delivery.`,
      "If an activity record is dated outside the window, either omit it or mention it in one context sentence explicitly labelled as outside the period. Do not blend it into this period's narrative.",
    );
  }
  if (title.includes("voice") || title.includes("testimonial") || title.includes("quote")) {
    guidance.push(
      "Quote beneficiary speech ONLY as verbatim sentences found inside evidence chunk text between double quotes; cite the evidence title after each quote. If no quotations exist in the evidence, write one honest sentence saying no testimonies were recorded.",
    );
  }
  if (title.includes("challenge") || title.includes("lesson")) {
    guidance.push(
      "Use only challenges/lessons recorded in activity updates or the story context. Synthesize them into prose grouped by theme; never invent causes or mitigations.",
    );
  }
  // WS4: cross-cutting sections — theme synthesis with verbatim, per-activity
  // disaggregation. Totals are never suggested: a computed sum would not be
  // verbatim in the input and would fail the numeric-consistency gate.
  if (
    /(protection|gender|safeguard|accountability|affected populations|\baap\b|do no harm|environment|climate)/.test(
      title,
    )
  ) {
    guidance.push(
      "Synthesize this section by theme (e.g. protection mainstreaming, gender, environment, accountability to affected populations) rather than activity-by-activity.",
      'Quote recorded participant disaggregation per activity verbatim (e.g. "45 women and 30 men"); never total, merge, or re-aggregate recorded counts.',
      "Where sex/age/disability breakdowns were not recorded for an activity, state that disaggregated data was not recorded for that activity.",
      "Describe complaints, feedback, and response mechanisms only as recorded in activities or evidence.",
    );
  }
  // WS4-lite: financial narrative discipline. Variance explanations come only
  // from the officer-recorded story context; the narrator never computes one.
  if (/(financial|budget|expenditure|finance)/.test(title)) {
    guidance.push(
      "Quote budget or variance explanations verbatim from the 'Tell the Story' narrative context when present.",
      "Never compute, derive, or restate variance figures that are not present verbatim in the input.",
      "When no recorded variance explanation exists, state that no variance explanation was recorded.",
    );
  }
  return guidance;
}

/**
 * Drafted sibling sections (section-wise generation). A synthesis section
 * (executive summary) is drafted last and summarises them; any other section
 * sees short excerpts so it does not restate them. Exported for tests.
 */
export function buildDraftedSectionsBlock(input: GenerateReportDraftInput, section: ReportPlanSection): string[] {
  const drafted = (input.draftedSections ?? []).filter((d) => d.title !== section.title && d.content.trim());
  if (drafted.length === 0) return [];
  const synthesis = isSynthesisSection(section);
  const limit = synthesis ? 1500 : 600;
  const excerpt = (text: string) => {
    const body = text.split("\n").filter((l) => !l.trimStart().startsWith("|")).join("\n").trim();
    return body.length > limit ? `${body.slice(0, limit)}…` : body;
  };
  return [
    synthesis
      ? `# Drafted report sections to synthesise (your summary MUST be consistent with these; select the most important results; introduce no facts they do not contain)`
      : `# Already-written sibling sections (do NOT restate their facts; refer to them by section name)`,
    ...drafted.slice(0, 10).map((d) => `## ${d.title}\n${excerpt(d.content)}`),
    ``,
  ];
}

function buildSectionNarratorUserPrompt(input: GenerateReportDraftInput, section: ReportPlanSection, agentMemoryGuidance: string[] = []): string {
  const profile = input.reportingProfileSnapshot;
  const toneInstruction = toneInstructionFor(profile);

  const ctx = input.reportContext;
  const projectBlock = buildProjectBlock(ctx);
  const periodBlock = buildPeriodBlock(ctx);
  const templateBlock = buildTemplateBlock(ctx);
  const findingsJson = buildFindingsJson(input);
  const indicatorUpdatesJson = buildIndicatorUpdatesJson(input);
  // Sections are drafted one at a time, so the prompt must be lean: a section
  // only needs a bounded slice of the evidence/activity record set. Dumping
  // every evidence chunk (8×800 chars each) and every activity narrative into
  // each section call made a single section take 113-142s with MiniMax.
  const evidenceJson = buildEvidenceJson(input, { maxPackages: 4, maxChunksPerPackage: 4, maxCharsPerChunk: 600 }, section);
  const activitiesJson = buildActivitiesJson(input, { maxActivities: 6, maxCharsPerField: 250 });

  const sectionGuidance = buildSectionGuidance(section);
  // Agent Memory (Phase 21) statements fold into the same array as the
  // section-specific quality guidance — one SSOT, no new prompt block.
  const specificGuidance = [...buildSectionSpecificGuidance(section, input), ...agentMemoryGuidance];
  const requirementGuidance = buildRequirementGuidanceBlock(section);
  const formattingRules = (profile.formattingRules ?? []).filter(Boolean);

  return [
    `# Report Drafting Request — Section-wise generation`,
    `# Draft ONLY the following section. Do not draft any other section.`,
    ``,
    `# Section to draft:`,
    sectionGuidance,
    ``,
    `# Tone: ${toneInstruction}`,
    `# Language: ${profile.language}`,
    ...(formattingRules.length > 0 ? [``, `# Formatting Rules`, ...formattingRules.map((r) => `- ${r}`)] : []),
    ``,
    ...projectBlock,
    ...periodBlock,
    ...templateBlock,
    ...buildVisibilityLines(ctx),
    ...buildStoryContextBlock(ctx),
    `# Section Guidance`,
    sectionGuidance,
    ``,
    ...requirementGuidance,
    ...buildDraftedSectionsBlock(input, section),
    `# Verified Findings`,
    findingsJson,
    ``,
    `# Indicator Updates`,
    indicatorUpdatesJson,
    ``,
    `# Activity Records`,
    activitiesJson,
    ``,
    `# Evidence Packages`,
    evidenceJson,
    ``,
    `# Instructions`,
    `Draft ONLY the section titled "${section.title}". Produce narrative content and structured claims for it.`,
    `The JSON output MUST contain exactly one section object whose "title" equals "${section.title}".`,
    `Only the evidence, activities, findings, and indicator updates above are available to you — do not invent numbers or records.`,
    ...(specificGuidance.length > 0 ? [`# Section-specific quality guidance`, ...specificGuidance.map((g) => `- ${g}`), ``] : []),
    ...buildAuthorInstructionBlock(input.sectionInstruction),
    ...buildInstructionTail(),
  ].join("\n");
}

/**
 * Report Editor B7 — the author's instruction for a single-section redraft.
 * Emitted only when present, so full-draft prompts stay byte-identical. It
 * steers emphasis and wording; it can never relax the grounding rules.
 */
export function buildAuthorInstructionBlock(instruction: string | undefined): string[] {
  const text = instruction?.trim();
  if (!text) return [];
  return [
    `# Author's instruction for this section`,
    `Follow this instruction from the report author unless it conflicts with the rules above (never invent facts or numbers):`,
    text,
    ``,
  ];
}

function buildRewriteUserPrompt(input: LlmRewriteSectionInput): string {
  const audienceInstruction =
    input.audience === "DONOR"
      ? "Adapt tone for a donor audience: formal, neutral, evidence-proportionate. Do not inflate results, add impact claims that the evidence does not support, or soften caveats."
      : input.audience === "INTERNAL"
        ? "Adapt tone for an internal audience: concise, operational."
        : "Use plain, accessible language.";

  return [
    `# Section Rewrite Request`,
    ``,
    `Section title: ${input.sectionTitle}`,
    `Mode: ${input.mode}`,
    `Audience: ${input.audience}`,
    `Tone: ${audienceInstruction}`,
    input.instructions ? `Editor note: ${input.instructions}` : "",
    ``,
    `# Existing Content`,
    input.content,
    ``,
    `Rules:`,
    `- Preserve every fact, number, and caveat exactly as stated.`,
    `- Never remove a caveat, limitation, or "Needs verification" marker unless you are rewriting it into an explicit statement about the evidence gap.`,
    `- Do not add outcomes, impact, or evaluative language unless the existing content already states it.`,
    `- Keep all lists and tables intact (SHORTEN mode).`,
    ``,
    `Return JSON: { "content": "rewritten text" }. No markdown fences, no extra text.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseSections(
  raw: string,
  planSections: Array<{ title: string }> = [],
): GeneratedSection[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Strip markdown code fences wherever they appear (a leading or trailing
  //    preamble around a fenced block is common from MiniMax).
  const json = trimmed.replace(/```(?:json)?\s*\n?/gi, "").replace(/```/g, "").trim();

  // 2. Try strict parse first (the common happy path).
  const direct = tryParseSections(json);
  if (direct) return direct;

  // 3. The response is JSON-like when it starts with a value char, or when it
  //    contains the expected "sections" wrapper key anywhere (MiniMax often
  //    wraps JSON in prose like 'Here is the JSON: {...}' or fences with a
  //    preamble). Locate the outermost balanced JSON value and parse only it.
  const jsonLike = json.startsWith("{") || json.startsWith("[") || /"sections"\s*:/.test(json);
  if (jsonLike) {
    const extracted = extractBalancedJson(json);
    if (extracted !== null) {
      const parsedExtract = tryParseSections(extracted);
      if (parsedExtract) return parsedExtract;
    }
    // It clearly wanted to be JSON but we could not make it parse. Never store
    // raw JSON as narrative content — signal malformed so the caller falls
    // back to the stub generator.
    return null;
  }

  // 4. Genuine prose (no JSON wrapper): keep the user's AI-produced text as a
  //    single narrative section instead of silently dropping it to the stub.
  return fallbackAsNarrative(raw, planSections);
}

/**
 * Detects a section whose content is itself a raw JSON blob (e.g. the whole
 * `{"sections": [...]}` response was captured as narrative). Guardrail for the
 * section-wise path: such content is malformed and must fall back to the stub.
 */
function looksLikeRawJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return false;
  const sample = trimmed.slice(0, 400);
  // A section's real narrative begins with prose, not a JSON key with a colon
  // in the opening characters.
  return /^\{[\s\n]*"[^"]+":/.test(sample);
}

function tryParseSections(json: string): GeneratedSection[] | null {
  const attempt = (text: string): GeneratedSection[] | null => {
    try {
      const parsed = JSON.parse(text) as { sections?: unknown };
      if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        const sections: GeneratedSection[] = [];
        for (let i = 0; i < parsed.sections.length; i++) {
          const sec = parsed.sections[i] as Record<string, unknown> | null;
          if (!sec || typeof sec !== "object") {
            return null;
          }
          const title = typeof sec.title === "string" ? sec.title.trim() : "";
          const content = typeof sec.content === "string" ? sec.content.trim() : "";
          if (!title || !content) {
            return null;
          }
          sections.push({
            sectionId: typeof sec.sectionId === "string" && sec.sectionId ? sec.sectionId : `section-${i}`,
            title,
            content,
            claims: parseClaims(sec.claims),
            sourceReferences: parseSourceReferences(sec.sourceReferences),
          });
        }
        return sections.length > 0 ? sections : null;
      }
      // Valid JSON but not in the expected sections-wrapper shape (either
      // missing the field or empty array). The LLM produced no usable content;
      // signal malformed so the caller falls back to the stub.
      return null;
    } catch {
      return null;
    }
  };

  const direct = attempt(json);
  if (direct) return direct;

  // MiniMax (and several other LLMs) frequently emit LITERAL unescaped control
  // characters inside JSON string values — e.g. a real newline inside the
  // "content" field. Strict JSON forbids this, so JSON.parse throws and every
  // section would fall back to the stub. Repair the document first: walk the
  // text, track string literals, and escape any raw control character found
  // inside a string (outside it, control chars are whitespace and are fine).
  const repaired = repairUnescapedControlChars(json);
  if (repaired !== json) {
    const retry = attempt(repaired);
    if (retry) return retry;
  }

  // maxTokens truncation: when a section's content (especially a markdown
  // table) is longer than the output budget, MiniMax returns a PREFIX of the
  // JSON document — the trailing string literal and/or closing braces are cut
  // off mid-output. The document is structurally incomplete, so neither strict
  // parse nor control-char repair can help. Attempt to complete the JSON by
  // closing unclosed strings and structures; salvage the parsed sections.
  const completed = completeTruncatedJson(repaired);
  if (completed !== null) {
    const retry = attempt(completed);
    if (retry) return retry;
  }
  return null;
}

/**
 * Attempts to repair a JSON document truncated by the output token limit.
 * Walks the text, tracking string/escape state and an open-structure stack;
 * when the input ends mid-string, mid-array, or mid-object, it appends the
 * missing closing characters. Returns null when the text is not truncatable
 * (already balanced) or cannot be completed.
 */
function completeTruncatedJson(text: string): string | null {
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escaped = false;
  let lastStructuralEnd = -1; // index of last complete `}` or `]`
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        lastStructuralEnd = i;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch as "{" | "[");
      lastStructuralEnd = -1;
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      lastStructuralEnd = i;
    }
  }

  // If we ended inside a string, close it first.
  let suffix = "";
  if (inString) {
    // The string may have been cut mid-value; closing the quote yields a
    // syntactically valid (if abbreviated) value.
    suffix += '"';
  }
  // Close any unclosed structures, innermost first.
  while (stack.length > 0) {
    const open = stack.pop()!;
    suffix += open === "{" ? "}" : "]";
  }
  if (!suffix) return null; // nothing to repair
  return text + suffix;
}

/**
 * Escapes literal (unescaped) ASCII control characters that appear INSIDE a
 * JSON string literal: \n, \r, \t, \f, \b, and any 0x00-0x1F. Returns the
 * original string unchanged when no repair was needed.
 */
function repairUnescapedControlChars(text: string): string {
  let repaired = false;
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n" || ch === "\r" || ch === "\t" || ch === "\f" || ch === "\b") {
        // Repair the control char as a \uXXXX escape.
        const hex = ch.charCodeAt(0).toString(16).padStart(4, "0");
        out += `\\u${hex}`;
        repaired = true;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
        repaired = true;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return repaired ? out : text;
}

/**
 * Extracts the outermost balanced JSON value (object or array) from a string
 * that may be wrapped in prose. Returns null when no balanced JSON value can
 * be located. The scanner understands string literals so braces inside quoted
 * content do not break the balance.
 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  const arrayStart = start === -1 ? text.indexOf("[") : start;
  if (arrayStart === -1) return null;
  const openChar = text[arrayStart]!;
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(arrayStart, i + 1);
      }
    }
  }
  return null;
}

/**
 * Last-resort recovery when the LLM returns prose instead of strict JSON.
 * Mirrors the single-section rewrite path: the entire response is treated as
 * one section whose title is taken from the first plan section (or a generic
 * label when no plan is available). This ensures the user's AI-produced text
 * is never silently dropped in favour of the stub generator.
 */
function fallbackAsNarrative(raw: string, planSections: Array<{ title: string }>): GeneratedSection[] | null {
  const text = raw.trim();
  if (!text) return null;
  const first = planSections[0]?.title?.trim();
  return [
    {
      sectionId: "narrative",
      title: first && first.length > 0 ? first : "Narrative",
      content: text,
      claims: [],
      sourceReferences: [],
    },
  ];
}

function parseClaims(value: unknown): ReportClaimDraft[] {
  if (!Array.isArray(value)) return [];
  const claims: ReportClaimDraft[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const text = typeof c.text === "string" ? c.text.trim() : "";
    if (!text) continue;
    const type = typeof c.type === "string" && CLAIM_TYPES.has(c.type as ClaimType)
      ? (c.type as ClaimType)
      : "FACTUAL";
    const proposedSources: ReportClaimDraft["proposedSources"] = [];
    if (Array.isArray(c.proposedSources)) {
      for (const s of c.proposedSources) {
        if (!s || typeof s !== "object") continue;
        const src = s as Record<string, unknown>;
        if (typeof src.evidenceId === "string" && typeof src.chunkId === "string") {
          proposedSources.push({
            evidenceId: src.evidenceId,
            chunkId: src.chunkId,
            sourceText: typeof src.sourceText === "string" ? src.sourceText : "",
          });
        }
      }
    }
    claims.push({ text, type, proposedSources });
  }
  return claims;
}

function parseSourceReferences(value: unknown): SourceReference[] {
  if (!Array.isArray(value)) return [];
  const refs: SourceReference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    if (!id) continue;
    const type = typeof r.type === "string" && REFERENCE_TYPES.has(r.type as SourceReference["type"])
      ? (r.type as SourceReference["type"])
      : "indicator";
    refs.push({
      type,
      id,
      label: typeof r.label === "string" ? r.label : undefined,
    });
  }
  return refs;
}

function parseRewrite(raw: string): string | null {
  let json = raw.trim();
  const fenceMatch = json.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) json = fenceMatch[1]!.trim();
  const attempt = (text: string): string | null => {
    try {
      const parsed = JSON.parse(text) as { content?: unknown };
      if (typeof parsed.content === "string") return parsed.content;
      return null;
    } catch {
      return null;
    }
  };
  const direct = attempt(json);
  if (direct !== null) return direct;
  // MiniMax emits literal unescaped control characters inside JSON string
  // values (e.g. a real newline inside "content"). Repair before giving up.
  const repaired = repairUnescapedControlChars(json);
  if (repaired !== json) {
    const retry = attempt(repaired);
    if (retry !== null) return retry;
  }
  if (json.length > 0 && !json.startsWith("{")) return json;
  return null;
}

/**
 * Classifies an LLM provider failure as a stable fallback reason so the audit
 * log and the UI can distinguish "provider timed out" from "PII firewall
 * rejected the prompt" instead of collapsing every failure into a generic
 * "AI unavailable" message.
 */
function classifyError(error: unknown): GeneratedDraftResult["fallbackReason"] {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (error.name === "AbortError" || message.includes("timeout") || message.includes("aborted")) {
      return "PROVIDER_TIMEOUT";
    }
    if (message.includes("pii") || message.includes("rejected")) {
      return "PII_REJECTED";
    }
    if (message.includes("http") || message.includes("api error") || message.includes("status")) {
      return "PROVIDER_HTTP_ERROR";
    }
  }
  return "PROVIDER_HTTP_ERROR";
}

export class LlmReportDraftGenerator implements IReportDraftGenerator {
  readonly model: LlmGeneratorModelInfo;

  constructor(
    private readonly provider: ILLMProvider,
    private readonly fallback: IReportDraftGenerator = new StubReportDraftGenerator(),
    private readonly logger?: ILogger,
    /** Agent Memory (Phase 21) — see the identical parameter on `AiReporterDraftGenerator`. */
    private readonly agentMemoryLookup?: (sectionTitle: string) => Promise<string[]>,
  ) {
    this.model = {
      modelId: provider.name,
      modelVersion: provider.model,
      // Version 4 adds language-craft rules (WS2), donor requirement guidance
      // and attribution blocks (WS1/WS3), and cross-cutting guidance (WS4).
      // Version 5 (report-quality v4) adds the drafted-sibling block (the
      // executive summary is drafted last, from the other sections) and
      // chunk-text evidence ranking.
      promptVersion: 5,
    };
  }

  async generateDraft(
    input: GenerateReportDraftInput,
  ): Promise<GeneratedDraftResult> {
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildNarratorUserPrompt(input);

      const result = await this.provider.complete({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 4096,
        temperature: 0.3,
      });

      if (!result.text || !result.text.trim()) {
        this.logger?.warn("LLM report draft: provider returned empty content; falling back to stub", {
          model: this.model.modelId,
        });
        const sections = await this.fallback.generateDraft(input);
        return {
          sections: sections.sections,
          usedFallback: true,
          fallbackReason: "PROVIDER_EMPTY_RESPONSE",
        };
      }

      const sections = parseSections(result.text, input.reportPlan.sections);
      if (!sections || sections.length === 0 || sections.some((s) => looksLikeRawJson(s.content))) {
        this.logger?.warn("LLM report draft: response failed structural validation; falling back to stub", {
          model: this.model.modelId,
          snippet: result.text.slice(0, 200),
        });
        const fallback = await this.fallback.generateDraft(input);
        return {
          sections: fallback.sections,
          usedFallback: true,
          fallbackReason: "PROVIDER_MALFORMED_RESPONSE",
        };
      }
      return { sections, usedFallback: false };
    } catch (error) {
      const reason = classifyError(error);
      this.logger?.warn("LLM report draft failed; falling back to stub", {
        model: this.model.modelId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.generateDraft(input);
      return {
        sections: fallback.sections,
        usedFallback: true,
        fallbackReason: reason,
      };
    }
  }

  async generateSection(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<GeneratedSectionResult> {
    const startedAt = Date.now();
    let promptHash = "";
    const title = section.title.toLowerCase();
    const hasRequiredInput = title.includes("challenge")
      ? input.activities.some((a) => a.challenges.trim())
      : title.includes("lesson")
        ? input.activities.some((a) => a.lessonsLearned.trim())
        : title.includes("next period") || title.includes("work plan")
          ? input.activities.some((a) => a.nextSteps.trim())
          : title.includes("activit")
            ? input.activities.length > 0
            : true;
    if (!hasRequiredInput) {
      const deterministic = await this.fallback.generateSection(input, section);
      return {
        section: deterministic.section,
        usedFallback: false,
        deterministicReason: "INSUFFICIENT_INPUT",
        telemetry: {
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          promptHash: "",
          responseChars: 0,
          parseOutcome: "INSUFFICIENT_INPUT",
        },
      };
    }
    try {
      const systemPrompt = buildSystemPrompt();
      const agentMemoryGuidance = this.agentMemoryLookup ? await this.agentMemoryLookup(section.title) : [];
      const userPrompt = buildSectionNarratorUserPrompt(input, section, agentMemoryGuidance);
      promptHash = createHash("sha256").update(`${systemPrompt}\n${userPrompt}`, "utf8").digest("hex");

      const result = await this.provider.complete({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 4096,
        temperature: 0.3,
      });

      if (!result.text || !result.text.trim()) {
        this.logger?.warn("LLM section draft: provider returned empty content; falling back to stub", {
          model: this.model.modelId,
          section: section.title,
        });
        const fallback = await this.fallback.generateSection(input, section);
        return {
          ...fallback,
          usedFallback: true,
          fallbackReason: "PROVIDER_EMPTY_RESPONSE",
          telemetry: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: Date.now() - startedAt,
            promptHash,
            responseChars: 0,
            parseOutcome: "EMPTY",
          },
        };
      }

      const sections = parseSections(result.text, [section]);
      const generated = sections && sections.length > 0 ? sections[0] : null;
      const responseHash = createHash("sha256").update(result.text, "utf8").digest("hex");
      if (!generated || looksLikeRawJson(generated.content)) {
        this.logger?.warn("LLM section draft: response failed structural validation; falling back to stub", {
          model: this.model.modelId,
          section: section.title,
          snippet: result.text.slice(0, 200),
        });
        const fallback = await this.fallback.generateSection(input, section);
        return {
          ...fallback,
          usedFallback: true,
          fallbackReason: "PROVIDER_MALFORMED_RESPONSE",
          telemetry: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: Date.now() - startedAt,
            promptHash,
            responseHash,
            responseChars: result.text.length,
            parseOutcome: "MALFORMED",
          },
        };
      }
      let parseOutcome: NonNullable<GeneratedSectionResult["telemetry"]>["parseOutcome"] = "RECOVERED";
      try {
        const parsed = JSON.parse(result.text.trim()) as { sections?: unknown };
        if (Array.isArray(parsed.sections)) parseOutcome = "VALID";
      } catch {
        if (!result.text.trim().startsWith("{") && !result.text.trim().startsWith("[") && !/"sections"\s*:/.test(result.text)) {
          parseOutcome = "DIRECT_PROSE";
        }
      }
      return {
        section: generated,
        usedFallback: false,
        telemetry: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          latencyMs: Date.now() - startedAt,
          promptHash,
          responseHash,
          responseChars: result.text.length,
          parseOutcome,
        },
      };
    } catch (error) {
      const reason = classifyError(error);
      this.logger?.warn("LLM section draft failed; falling back to stub", {
        model: this.model.modelId,
        section: section.title,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.generateSection(input, section);
      return {
        ...fallback,
        usedFallback: true,
        fallbackReason: reason,
        telemetry: {
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          promptHash,
          responseChars: 0,
          parseOutcome: "PROVIDER_ERROR",
        },
      };
    }
  }

  async rewriteSection(
    input: LlmRewriteSectionInput,
  ): Promise<{
    content: string;
    unsupportedClaims: string[];
    writerClaims?: ReportClaimDraft[];
    promptHash?: string;
    responseHash?: string;
    fallbackUsed?: boolean;
    fallbackReason?: GeneratedDraftResult["fallbackReason"];
  }> {
    try {
      const systemPrompt = "You are a precise report editor. Return only JSON. No markdown fences.";
      const userPrompt = buildRewriteUserPrompt(input);
      const result = await this.provider.complete({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 2048,
        temperature: input.mode === "SHORTEN" ? 0.1 : 0.3,
      });

      if (!result.text || !result.text.trim()) {
        this.logger?.warn("LLM section rewrite: provider returned empty content; falling back to stub", {
          model: this.model.modelId,
        });
        const fallback = await this.fallback.rewriteSection(input);
        return { ...fallback, fallbackUsed: true, fallbackReason: "PROVIDER_EMPTY_RESPONSE" };
      }

      const content = parseRewrite(result.text);
      if (!content) {
        this.logger?.warn("LLM section rewrite: response failed to parse; falling back to stub", {
          model: this.model.modelId,
          snippet: result.text.slice(0, 200),
        });
        const fallback = await this.fallback.rewriteSection(input);
        return { ...fallback, fallbackUsed: true, fallbackReason: "PROVIDER_MALFORMED_RESPONSE" };
      }
      return {
        content,
        unsupportedClaims: [],
        // The rewrite does not introduce new structured claims; the assurance
        // extractor reads the new content directly. writerClaims stays empty.
        writerClaims: [],
        promptHash: createHash("sha256").update(systemPrompt + "\n" + userPrompt, "utf8").digest("hex"),
        responseHash: createHash("sha256").update(result.text, "utf8").digest("hex"),
      };
    } catch (error) {
      const reason = classifyError(error);
      this.logger?.warn("LLM section rewrite failed; falling back to stub", {
        model: this.model.modelId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.rewriteSection(input);
      return { ...fallback, fallbackUsed: true, fallbackReason: reason };
    }
  }
}
