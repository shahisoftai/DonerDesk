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

function buildSystemPrompt(): string {
  return [
    "You are a precise donor report narrator.",
    "You MUST only describe data that appears verbatim in the provided verified findings or evidence.",
    "You MUST NOT compute, aggregate, extrapolate, or infer any numbers not present in the input.",
    "You MUST NOT use evaluative language (positive/negative) for indicators with unresolved semantics.",
    "You may only use evaluative wording (favourable/unfavourable) when the finding's performanceEvaluation permits it.",
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
    `      "content": "During the reporting period the project delivered 30 training sessions reaching 850 beneficiaries. IND-001 (Beneficiaries trained) reached 85% of its target of 1,000, up from 500 in the previous period. No significant challenges were recorded.",`,
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
    `- Period: ${ctx.period.startDate} to ${ctx.period.endDate}`,
    ctx.period.deadline ? `- Submission Deadline: ${ctx.period.deadline}` : null,
    ctx.period.internalReviewDeadline ? `- Internal Review Deadline: ${ctx.period.internalReviewDeadline}` : null,
    ctx.period.readinessScore !== undefined && ctx.period.readinessScore !== null
      ? `- Readiness Score: ${ctx.period.readinessScore}/100`
      : null,
    ``,
  ].filter(Boolean) as string[];
}

function buildTemplateBlock(ctx: GenerateReportDraftInput["reportContext"]): string[] {
  if (!ctx?.template) return [];
  return [
    `# Donor Template`,
    `- Template: ${ctx.template.templateName} (v${ctx.template.version})`,
    `- Donor: ${ctx.template.donorName}`,
    `- Template Language: ${ctx.template.language}`,
    ctx.template.requiredAnnexes.length > 0
      ? `- Required Annexes: ${ctx.template.requiredAnnexes.join(", ")}`
      : null,
    ctx.template.notes ? `- Template Notes: ${ctx.template.notes}` : null,
    ``,
  ].filter(Boolean) as string[];
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
      value: f.value,
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

function buildEvidenceJson(input: GenerateReportDraftInput, limits?: { maxPackages?: number; maxChunksPerPackage?: number; maxCharsPerChunk?: number }): string {
  const maxPackages = limits?.maxPackages ?? Infinity;
  const maxChunksPerPackage = limits?.maxChunksPerPackage ?? 8;
  const maxCharsPerChunk = limits?.maxCharsPerChunk ?? 800;
  return JSON.stringify(
    input.evidencePackages.slice(0, maxPackages).map((p) => ({
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

function buildSectionGuidance(s: ReportPlanSection): string {
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
  return lines.join("\n");
}

function buildInstructionTail(): string[] {
  return [
    `Use the Project Context, Reporting Period, and Donor Template blocks to frame the report correctly.`,
    `Narrative MUST draw on the activity records and indicator updates provided, and MUST cite evidence:`,
    `- Use activity titles, dates, locations and participant counts (including disaggregation) from the Activity Records.`,
    `- Use recorded achievements, challenges, lessons learned and next steps verbatim from activity updates.`,
    `- Use indicator comments and data sources from the Indicator Updates as context.`,
    `- Describe each indicator by its name and code. When a target exists, describe progress against the target using only the target and value provided.`,
    `- When a comparisonValue exists, describe the period-on-period change using only the values provided (e.g. "up from 500 in the previous period").`,
    `Claims must reference evidence by evidenceId and chunkId from the evidence packages above.`,
    `Every section MUST list its source references: indicators, evidence files, and activities actually used.`,
    `Honour the per-section input type: INDICATOR_TABLE sections must be tables, ANNEX sections must list annexed files, COMPLIANCE sections must state compliance status against the template requirements.`,
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

function buildSectionNarratorUserPrompt(input: GenerateReportDraftInput, section: ReportPlanSection): string {
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
  const evidenceJson = buildEvidenceJson(input, { maxPackages: 4, maxChunksPerPackage: 4, maxCharsPerChunk: 400 });
  const activitiesJson = buildActivitiesJson(input, { maxActivities: 6, maxCharsPerField: 250 });

  const sectionGuidance = buildSectionGuidance(section);
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
    `# Section Guidance`,
    sectionGuidance,
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
    `Draft ONLY the section titled "${section.title}". Produce narrative content and structured claims for it.`,
    `The JSON output MUST contain exactly one section object whose "title" equals "${section.title}".`,
    `Only the evidence, activities, findings, and indicator updates above are available to you — do not invent numbers or records.`,
    ...buildInstructionTail(),
  ].join("\n");
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
  ) {
    this.model = {
      modelId: provider.name,
      modelVersion: provider.model,
      promptVersion: Number(provider.promptVersion) || 1,
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
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildSectionNarratorUserPrompt(input, section);

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
        return { ...fallback, usedFallback: true, fallbackReason: "PROVIDER_EMPTY_RESPONSE" };
      }

      const sections = parseSections(result.text, [section]);
      const generated = sections && sections.length > 0 ? sections[0] : null;
      if (!generated || looksLikeRawJson(generated.content)) {
        this.logger?.warn("LLM section draft: response failed structural validation; falling back to stub", {
          model: this.model.modelId,
          section: section.title,
          snippet: result.text.slice(0, 200),
        });
        const fallback = await this.fallback.generateSection(input, section);
        return { ...fallback, usedFallback: true, fallbackReason: "PROVIDER_MALFORMED_RESPONSE" };
      }
      return { section: generated, usedFallback: false };
    } catch (error) {
      const reason = classifyError(error);
      this.logger?.warn("LLM section draft failed; falling back to stub", {
        model: this.model.modelId,
        section: section.title,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.generateSection(input, section);
      return { ...fallback, usedFallback: true, fallbackReason: reason };
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
