import type {
  IReportDraftGenerator,
  GenerateReportDraftInput,
  GeneratedSection,
  ReportClaimDraft,
  ILLMProvider,
  LlmGeneratorModelInfo,
} from "@donordesk/application";
import type { SourceReference } from "@donordesk/domain";
import { StubReportDraftGenerator } from "./report-draft-generator.js";

interface LlmRewriteSectionInput {
  sectionTitle: string;
  content: string;
  mode: "REWRITE" | "SHORTEN";
  audience: "DONOR" | "INTERNAL" | "GENERAL";
  instructions?: string;
  sourceReferences: SourceReference[];
}

function buildSystemPrompt(): string {
  return [
    "You are a precise donor report narrator.",
    "You MUST only describe data that appears verbatim in the provided verified findings or evidence.",
    "You MUST NOT compute, aggregate, extrapolate, or infer any numbers not present in the input.",
    "You MUST NOT use evaluative language (positive/negative) for indicators with unresolved semantics.",
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
    `      "sourceReferences": [{ "type": "indicator|evidence|activity_update", "id": "string", "label": "string" }]`,
    `    }`,
    `  ]`,
    `}`,
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

  const findingsJson = JSON.stringify(
    input.verifiedFindings.map((f) => ({
      indicatorId: f.indicatorId,
      indicatorCode: f.indicatorCode,
      value: f.value,
      unit: f.unit ?? null,
      calculationMethod: f.calculationMethod,
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
      chunks: p.chunks.map((c) => ({ chunkId: c.chunkId, text: c.text.slice(0, 300) })),
    })),
    null,
  );

  return [
    `# Report Drafting Request`,
    `# Required sections: ${input.reportPlan.sections.length}`,
    `${sections}`,
    ``,
    `# Tone: ${toneInstruction}`,
    `# Language: ${profile.language}`,
    ``,
    `# Report Plan`,
    JSON.stringify(input.reportPlan, null, 2),
    ``,
    `# Verified Findings`,
    findingsJson,
    ``,
    `# Evidence Packages`,
    evidenceJson,
    ``,
    `# Instructions`,
    `Draft all sections. For each section, produce narrative content and structured claims.`,
    `Claims must reference evidence by evidenceId and chunkId from the evidence packages above.`,
    `Quality flags on findings (e.g. LOW_COVERAGE, NEEDS_REVIEW) should be noted as caveats in the narrative.`,
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

function parseSections(raw: string): GeneratedSection[] | null {
  let json = raw.trim();
  const fenceMatch = json.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) json = fenceMatch[1]!;
  try {
    const parsed = JSON.parse(json) as {
      sections?: unknown[];
    };
    if (!Array.isArray(parsed.sections)) return null;
    return parsed.sections.map((s, i) => {
      const sec = s as Record<string, unknown>;
      return {
        sectionId: typeof sec.sectionId === "string" ? sec.sectionId : `section-${i}`,
        title: String(sec.title ?? `Section ${i + 1}`),
        content: typeof sec.content === "string" ? sec.content : "",
        claims: [] as ReportClaimDraft[],
        sourceReferences: [] as SourceReference[],
      };
    });
  } catch {
    return null;
  }
}

function parseRewrite(raw: string): string | null {
  let json = raw.trim();
  const fenceMatch = json.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) json = fenceMatch[1]!;
  try {
    const parsed = JSON.parse(json) as { content?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
    return null;
  } catch {
    return null;
  }
}

export class LlmReportDraftGenerator implements IReportDraftGenerator {
  readonly model: LlmGeneratorModelInfo;

  constructor(
    private readonly provider: ILLMProvider,
    private readonly fallback: IReportDraftGenerator = new StubReportDraftGenerator(),
  ) {
    this.model = {
      modelId: provider.name,
      modelVersion: provider.model,
      promptVersion: Number(provider.promptVersion) || 1,
    };
  }

  async generateDraft(
    input: GenerateReportDraftInput,
  ): Promise<GeneratedSection[]> {
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildNarratorUserPrompt(input);

      const result = await this.provider.complete({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 8192,
        temperature: 0.3,
      });

      const sections = parseSections(result.text);
      if (!sections || sections.length === 0) {
        return this.fallback.generateDraft(input);
      }
      return sections;
    } catch {
      return this.fallback.generateDraft(input);
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

      const content = parseRewrite(result.text);
      if (!content) {
        return this.fallback.rewriteSection(input);
      }
      return { content, unsupportedClaims: [] };
    } catch {
      return this.fallback.rewriteSection(input);
    }
  }
}
