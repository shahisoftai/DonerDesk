import type {
  IReportDraftGenerator,
  GenerateReportDraftInput,
  GeneratedDraftResult,
  GeneratedSection,
  ReportClaimDraft,
  ILLMProvider,
  LlmGeneratorModelInfo,
  ILogger,
} from "@donordesk/application";
import type { SourceReference, ClaimType } from "@donordesk/domain";
import { StubReportDraftGenerator } from "./report-draft-generator.js";

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

function buildNarratorUserPrompt(input: GenerateReportDraftInput): string {
  const profile = input.reportingProfileSnapshot;
  const toneInstruction =
    profile.tone === "FORMAL"
      ? "Use formal, professional donor-reporting language."
      : profile.tone === "CONCISE"
        ? "Be concise and to the point."
        : profile.tone === "NARRATIVE"
          ? "Write in a flowing narrative style."
          : "Use technical language appropriate for a donor audience.";

  const sections = input.reportPlan.sections
    .map((s) => `- ${s.title}`)
    .join("\n");

  const ctx = input.reportContext;

  const projectBlock = ctx?.project
    ? [
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
      ]
    : [];

  const periodBlock = ctx?.period
    ? [
        `# Reporting Period`,
        `- Report Type: ${ctx.period.reportType}`,
        `- Period: ${ctx.period.startDate} to ${ctx.period.endDate}`,
        ctx.period.deadline ? `- Submission Deadline: ${ctx.period.deadline}` : null,
        ctx.period.internalReviewDeadline ? `- Internal Review Deadline: ${ctx.period.internalReviewDeadline}` : null,
        ctx.period.readinessScore !== undefined && ctx.period.readinessScore !== null
          ? `- Readiness Score: ${ctx.period.readinessScore}/100`
          : null,
        ``,
      ]
    : [];

  const templateBlock = ctx?.template
    ? [
        `# Donor Template`,
        `- Template: ${ctx.template.templateName} (v${ctx.template.version})`,
        `- Donor: ${ctx.template.donorName}`,
        `- Template Language: ${ctx.template.language}`,
        ctx.template.requiredAnnexes.length > 0
          ? `- Required Annexes: ${ctx.template.requiredAnnexes.join(", ")}`
          : null,
        ctx.template.notes ? `- Template Notes: ${ctx.template.notes}` : null,
        ``,
      ]
    : [];

  const findingsJson = JSON.stringify(
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

  const evidenceJson = JSON.stringify(
    input.evidencePackages.map((p) => ({
      evidenceId: p.evidenceId,
      title: p.title,
      evidenceType: p.evidenceType,
      verificationStatus: p.verificationStatus,
      confidentialityLevel: p.confidentialityLevel,
      chunks: p.chunks.slice(0, 8).map((c) => ({ chunkId: c.chunkId, text: c.text.slice(0, 800) })),
    })),
    null,
  );

  const activitiesJson = JSON.stringify(
    input.activities.map((a) => ({
      activityId: a.activityId,
      activityTitle: a.activityTitle,
      activityDate: a.activityDate.toISOString().slice(0, 10),
      location: a.location ?? null,
      participantsTotal: a.participantsTotal ?? null,
      participantsMale: a.participantsMale ?? null,
      participantsFemale: a.participantsFemale ?? null,
      participantsChildren: a.participantsChildren ?? null,
      participantsDisability: a.participantsDisability ?? null,
      summary: a.summary,
      achievements: a.achievements,
      challenges: a.challenges,
      lessonsLearned: a.lessonsLearned,
      nextSteps: a.nextSteps,
      attachedEvidenceIds: a.attachedEvidenceIds,
      status: a.status,
    })),
    null,
  );

  const indicatorUpdatesJson = JSON.stringify(
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

  const sectionGuidance = input.reportPlan.sections
    .map((s) => {
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
    })
    .join("\n");

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
  ].join("\n");
}

function buildRewriteUserPrompt(input: LlmRewriteSectionInput): string {
  const audienceInstruction =
    input.audience === "DONOR"
      ? "Adapt tone for a donor audience: formal, positive, impact-focused."
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
    input.mode === "SHORTEN"
      ? "Shorten the content by keeping only the most essential sentences. Preserve lists and tables as-is."
      : "Rewrite the content in the specified tone and audience. Preserve all facts. Remove [Needs verification] flags.",
    ``,
    `Return JSON: { "content": "rewritten text" }. No markdown fences, no extra text.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseSections(raw: string): GeneratedSection[] | null {
  let json = raw.trim();
  const fenceMatch = json.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) json = fenceMatch[1]!;
  try {
    const parsed = JSON.parse(json) as {
      sections?: unknown;
    };
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;

    const sections: GeneratedSection[] = [];
    for (let i = 0; i < parsed.sections.length; i++) {
      const sec = parsed.sections[i] as Record<string, unknown> | null;
      if (!sec || typeof sec !== "object") return null;
      const title = typeof sec.title === "string" ? sec.title.trim() : "";
      const content = typeof sec.content === "string" ? sec.content.trim() : "";
      if (!title || !content) return null;
      sections.push({
        sectionId: typeof sec.sectionId === "string" && sec.sectionId ? sec.sectionId : `section-${i}`,
        title,
        content,
        claims: parseClaims(sec.claims),
        sourceReferences: parseSourceReferences(sec.sourceReferences),
      });
    }
    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
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
  try {
    const parsed = JSON.parse(json) as { content?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
  } catch {
    // Not strict JSON — MiniMax sometimes narrates directly. Accept the text
    // as the rewrite result so the user's edit is not silently dropped.
  }
  if (json.length > 0 && !json.startsWith("{")) return json;
  return null;
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
        return { sections: sections.sections, usedFallback: true };
      }

      const sections = parseSections(result.text);
      if (!sections || sections.length === 0) {
        this.logger?.warn("LLM report draft: response failed structural validation; falling back to stub", {
          model: this.model.modelId,
          snippet: result.text.slice(0, 200),
        });
        const fallback = await this.fallback.generateDraft(input);
        return { sections: fallback.sections, usedFallback: true };
      }
      return { sections, usedFallback: false };
    } catch (error) {
      this.logger?.warn("LLM report draft failed; falling back to stub", {
        model: this.model.modelId,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.generateDraft(input);
      return { sections: fallback.sections, usedFallback: true };
    }
  }

  async rewriteSection(input: LlmRewriteSectionInput): Promise<{ content: string; unsupportedClaims: string[] }> {
    try {
      const result = await this.provider.complete({
        systemPrompt: "You are a precise report editor. Return only JSON. No markdown fences.",
        userPrompt: buildRewriteUserPrompt(input),
        jsonMode: true,
        maxTokens: 2048,
        temperature: input.mode === "SHORTEN" ? 0.1 : 0.3,
      });

      if (!result.text || !result.text.trim()) {
        this.logger?.warn("LLM section rewrite: provider returned empty content; falling back to stub", {
          model: this.model.modelId,
        });
        return this.fallback.rewriteSection(input);
      }

      const content = parseRewrite(result.text);
      if (!content) {
        this.logger?.warn("LLM section rewrite: response failed to parse; falling back to stub", {
          model: this.model.modelId,
          snippet: result.text.slice(0, 200),
        });
        return this.fallback.rewriteSection(input);
      }
      return { content, unsupportedClaims: [] };
    } catch (error) {
      this.logger?.warn("LLM section rewrite failed; falling back to stub", {
        model: this.model.modelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback.rewriteSection(input);
    }
  }
}
