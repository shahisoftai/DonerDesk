import { createHash } from "node:crypto";
import type {
  IReportDraftGenerator,
  GenerateReportDraftInput,
  GeneratedArtifact,
  GeneratedChartSpec,
  GeneratedDelta,
  GeneratedDraftResult,
  GeneratedQaItem,
  GeneratedSection,
  GeneratedSectionResult,
  GeneratedTablePayload,
  GeneratedListPayload,
  GeneratedKeyValuePayload,
  ReportClaimDraft,
  RetrievedEvidence,
  LlmGeneratorModelInfo,
  ILogger,
} from "@donordesk/application";
import type { ReportPlanSection, SourceReference } from "@donordesk/domain";
import type { StubReportDraftGenerator } from "./report-draft-generator.js";
import type { IEmbeddingGenerator, IEmbeddingStore } from "./embedding.js";
import { SemanticEvidenceRetriever } from "./semantic-evidence-retriever.js";
import type {
  AiReporterArtifact,
  AiReporterChartPayload,
  AiReporterDeltaPayload,
  AiReporterQaPayload,
  AiReporterActivity,
  AiReporterContext,
  AiReporterFinding,
  AiReporterIndicatorUpdate,
  AiReporterPriorNarrative,
  AiReporterSectionRequest,
  AiReporterSectionResponse,
  AiReporterSourceReference,
  IWorkerClient,
} from "./ai-reporter-worker.js";
import type { IPriorPeriodService } from "./prior-period.js";
import { runAll as runArtifactValidators, type RunAllOptions } from "../ai/artifact-validators.js";

const CLAIM_TYPES = new Set(["NUMERIC", "FACTUAL", "CAUSAL", "QUALITATIVE"]);
const REFERENCE_TYPES = new Set(["evidence", "activity", "indicator", "template"]);
const VALID_REFERENCE_TYPES = new Set(["indicator", "evidence", "activity", "template"] as const);
const ARTIFACT_KINDS = new Set<GeneratedArtifact["kind"]>(["TABLE", "CHART", "LIST", "KEY_VALUE", "QA", "DELTA"]);

/**
 * AI Reporter draft generator. Adapter that fulfils the IReportDraftGenerator
 * port by calling the Python AI Reporter worker over HTTP, so the deterministic
 * assurance pipeline (assertions, verification, gates, revision, audit) is
 * unchanged. The reporter only narrates verified findings; every material
 * assertion is still extracted and verified downstream.
 */
export class AiReporterDraftGenerator implements IReportDraftGenerator {
  readonly model: LlmGeneratorModelInfo;

  constructor(
    private readonly worker: IWorkerClient,
    private readonly fallback: StubReportDraftGenerator,
    private readonly embeddingGenerator?: IEmbeddingGenerator,
    private readonly embeddingStore?: IEmbeddingStore,
    private readonly prior?: IPriorPeriodService,
    private readonly logger?: ILogger,
    private readonly writerContractVersion = Number(process.env.AI_REPORTER_CONTRACT_VERSION ?? 1),
    private readonly modelConfig: { provider: string; model?: string } = {
      provider: process.env.AI_REPORTER_PROVIDER ?? "openai",
      model: process.env.AI_REPORTER_MODEL,
    },
  ) {
    this.model = {
      modelId: "ai-reporter",
      modelVersion: `${this.modelConfig.provider}/${this.modelConfig.model ?? "default"}`,
      promptVersion: this.writerContractVersion,
    };
  }

  async generateDraft(input: GenerateReportDraftInput): Promise<GeneratedDraftResult> {
    const sections: GeneratedSection[] = [];
    let anyFallback = false;
    let lastFallbackReason: GeneratedDraftResult["fallbackReason"];
    for (const section of input.reportPlan.sections) {
      const result = await this.generateSection(input, section);
      sections.push(result.section);
      if (result.usedFallback) {
        anyFallback = true;
        lastFallbackReason = result.fallbackReason;
        // Continue: per-section fallback — a single slow section no longer
        // demotes the whole draft.
      }
    }
    if (anyFallback) {
      return { sections, usedFallback: true, fallbackReason: lastFallbackReason };
    }
    return { sections, usedFallback: false };
  }

  async generateSection(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<GeneratedSectionResult> {
    const startedAt = Date.now();
    try {
      const request = await this.buildSectionRequest(input, section);
      const response = await this.worker.draftSection(request);
      if (!response.ok) {
        this.logger?.warn("AI Reporter draft failed; falling back to stub", {
          section: section.title,
          error: response.error.message,
        });
        const fallback = await this.fallback.generateSection(input, section);
        return {
          ...fallback,
          usedFallback: true,
          fallbackReason: "PROVIDER_HTTP_ERROR",
          telemetry: {
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: Date.now() - startedAt,
            promptHash: "",
            responseChars: 0,
            parseOutcome: "PROVIDER_ERROR",
          },
        };
      }

      const payload = response.value;
      const content = payload.content.trim();
      if (!content) {
        const fallback = await this.fallback.generateSection(input, section);
        return {
          ...fallback,
          usedFallback: true,
          fallbackReason: "PROVIDER_EMPTY_RESPONSE",
          telemetry: {
            inputTokens: payload.telemetry?.inputTokens ?? 0,
            outputTokens: payload.telemetry?.outputTokens ?? 0,
            latencyMs: Date.now() - startedAt,
            promptHash: payload.telemetry?.promptHash ?? "",
            responseChars: 0,
            parseOutcome: "EMPTY",
          },
        };
      }

      // Map AI Reporter 2 typed artifacts.
      const artifacts = mapArtifacts(payload.artifacts);
      const qa = mapQa(payload.qa);
      const chartSpec = mapChartPayload(payload.chartSpec);
      const deltaFromPrior = mapDeltaPayload(payload.deltaFromPrior);

      const generatedSection: GeneratedSection = {
        sectionId: payload.sectionId || section.templateSectionId || `section-${section.title}`,
        title: payload.title || section.title,
        content,
        claims: mapClaims(payload.claims),
        sourceReferences: mapReferences(payload.sourceReferences),
        artifacts,
        qa,
        chartSpec: chartSpec ?? undefined,
        deltaFromPrior: deltaFromPrior ?? undefined,
      };

      // Self-check (mirror of worker artifact_validators). On hard failure we
      // log the issues but keep the section (the deterministic evaluator
      // surfaces them in CI).
      const verifiedNumbers = new Set<string>();
      for (const f of input.verifiedFindings) {
        if (f.value !== null && f.value !== undefined) verifiedNumbers.add(String(f.value));
      }
      const validatorOpts: RunAllOptions = {
        verifiedNumbers,
        priorNarrativePresent: Boolean(this.prior) && (await this.prior?.fetch(input, section))?.length !== 0,
        mandatoryQuestions: section.mandatoryQuestions ?? [],
        priorSectionsSummary: [], // filled in by the handler in batch mode
        minWords: section.wordLimit?.min,
        maxWords: section.wordLimit?.max,
      };
      const validatorResult = runArtifactValidators(generatedSection, validatorOpts);
      if (!validatorResult.ok) {
        this.logger?.warn("AI Reporter validator issues", {
          section: section.title,
          issues: validatorResult.issues,
        });
      }

      const telemetry: GeneratedSectionResult["telemetry"] = {
        inputTokens: payload.telemetry?.inputTokens ?? 0,
        outputTokens: payload.telemetry?.outputTokens ?? 0,
        latencyMs: Date.now() - startedAt,
        promptHash: payload.telemetry?.promptHash ?? "",
        responseHash: payload.telemetry?.responseHash,
        responseChars: content.length,
        parseOutcome: validatorResult.ok ? "VALID" : "PROVIDER_ERROR",
      };

      return { section: generatedSection, usedFallback: false, telemetry };
    } catch (error) {
      this.logger?.warn("AI Reporter draft threw; falling back to stub", {
        section: section.title,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.generateSection(input, section);
      return {
        ...fallback,
        usedFallback: true,
        fallbackReason: "PROVIDER_HTTP_ERROR",
        telemetry: {
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          promptHash: "",
          responseChars: 0,
          parseOutcome: "PROVIDER_ERROR",
        },
      };
    }
  }

  async rewriteSection(input: {
    sectionTitle: string;
    content: string;
    mode: "REWRITE" | "SHORTEN";
    audience: "DONOR" | "INTERNAL" | "GENERAL";
    instructions?: string;
    sourceReferences: SourceReference[];
  }): Promise<{
    content: string;
    unsupportedClaims: string[];
    writerClaims?: ReportClaimDraft[];
    promptHash?: string;
    responseHash?: string;
    fallbackUsed?: boolean;
    fallbackReason?: GeneratedDraftResult["fallbackReason"];
  }> {
    try {
      const response = await this.worker.rewriteSection({
        sectionTitle: input.sectionTitle,
        content: input.content,
        mode: input.mode,
        audience: input.audience,
        instructions: input.instructions,
        sourceReferences: input.sourceReferences.map((r) => ({
          type: (REFERENCE_TYPES.has(r.type) ? r.type : "indicator") as "indicator" | "evidence" | "activity" | "template",
          id: r.id,
          label: r.label,
        })),
        writerContractVersion: this.writerContractVersion,
        model: this.modelConfig,
      });
      if (!response.ok) {
        const fallback = await this.fallback.rewriteSection(input);
        return { ...fallback, fallbackUsed: true, fallbackReason: "PROVIDER_HTTP_ERROR" };
      }
      const content = response.value.content.trim();
      if (!content) {
        const fallback = await this.fallback.rewriteSection(input);
        return { ...fallback, fallbackUsed: true, fallbackReason: "PROVIDER_EMPTY_RESPONSE" };
      }
      return {
        content,
        unsupportedClaims: [],
        writerClaims: [],
        promptHash: response.value.promptHash ?? createHash("sha256").update(`${input.sectionTitle}\n${input.content}`, "utf8").digest("hex"),
        responseHash: response.value.responseHash,
        fallbackUsed: false,
      };
    } catch (error) {
      this.logger?.warn("AI Reporter rewrite threw; falling back to stub", {
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.fallback.rewriteSection(input);
      return { ...fallback, fallbackUsed: true, fallbackReason: "PROVIDER_HTTP_ERROR" };
    }
  }

  private async buildSectionRequest(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<AiReporterSectionRequest> {
    const retrieved = await this.buildRetrievedEvidence(input, section);
    const prior = this.prior ? await this.prior.fetch(input, section) : [];

    return {
      section: {
        title: section.title,
        inputType: section.inputType,
        minWords: section.wordLimit?.min,
        maxWords: section.wordLimit?.max,
        mandatoryQuestions: section.mandatoryQuestions ?? [],
        evidenceNeeds: section.evidenceNeeds ?? [],
        relatedLogframeElement: section.relatedLogframeElement,
      },
      context: this.buildContext(input),
      verifiedFindings: input.verifiedFindings.map((f) => ({
        indicatorCode: f.indicatorCode,
        indicatorName: f.indicatorName ?? undefined,
        baseline: f.baseline ?? null,
        target: f.target ?? null,
        value: f.qualityFlags.includes("MISSING_DENOMINATOR") ? null : f.value,
        valueStatus: f.qualityFlags.includes("MISSING_DENOMINATOR") ? "NOT_CALCULABLE" : "KNOWN",
        unit: f.unit ?? null,
        performanceEvaluation: f.performanceEvaluation ? { type: f.performanceEvaluation.type } : null,
        qualityFlags: f.qualityFlags,
        comparisonValue: f.comparisonValue ?? null,
      })),
      indicatorUpdates: input.indicatorUpdates.map((u) => ({
        indicatorCode: u.indicatorCode,
        periodAchievement: u.periodAchievement,
        cumulativeAchievement: u.cumulativeAchievement,
        comments: u.comments,
        dataSource: u.dataSource,
      })),
      activities: input.activities.map((a) => ({
        title: a.activityTitle,
        date: a.activityDate.toISOString().slice(0, 10),
        location: a.location,
        participantsTotal: a.participantsTotal,
        participantsMale: a.participantsMale,
        participantsFemale: a.participantsFemale,
        participantsChildren: a.participantsChildren,
        participantsDisability: a.participantsDisability,
        summary: a.summary,
        achievements: a.achievements,
        challenges: a.challenges,
        lessonsLearned: a.lessonsLearned,
        nextSteps: a.nextSteps,
      })),
      retrievedEvidence: retrieved,
      priorNarrative: prior,
      writerContractVersion: this.writerContractVersion,
      model: this.modelConfig,
    };
  }

  private async buildRetrievedEvidence(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<AiReporterSectionRequest["retrievedEvidence"]> {
    const maxPackages = 6;
    const maxChunks = 6;
    const maxChars = 600;

    if (this.embeddingGenerator && this.embeddingStore) {
      const retriever = new SemanticEvidenceRetriever(input.evidencePackages, this.embeddingGenerator, this.embeddingStore);
      const entities = [
        input.reportContext?.project?.title ?? "",
        input.reportContext?.project?.sector ?? "",
        input.reportContext?.project?.country ?? "",
      ].filter(Boolean);
      const dates = [
        input.reportContext?.period?.startDate ?? "",
        input.reportContext?.period?.endDate ?? "",
      ].filter(Boolean);
      const indicatorCodes = input.verifiedFindings.map((f) => f.indicatorCode);
      const result = await retriever.retrieve({
        sectionTitle: section.title,
        entities,
        dates,
        indicatorCodes,
        maxTokens: 3000,
        tenantId: input.reportPlan.tenantId,
      });
      if (result.ok && result.value.length > 0) {
        return groupByEvidence(result.value, input, maxPackages, maxChunks, maxChars);
      }
    }

    // Default: bounded pass-through of the already tenant-scoped packages.
    return input.evidencePackages.slice(0, maxPackages).map((p) => ({
      evidenceId: p.evidenceId,
      title: p.title,
      evidenceType: p.evidenceType,
      verificationStatus: p.verificationStatus,
      confidentialityLevel: p.confidentialityLevel,
      chunks: p.chunks.slice(0, maxChunks).map((c) => ({ chunkId: c.chunkId, text: c.text.slice(0, maxChars) })),
    }));
  }

  private buildContext(input: GenerateReportDraftInput): AiReporterContext {
    const ctx = input.reportContext;
    return {
      project: ctx?.project
        ? {
            title: ctx.project.title,
            projectCode: ctx.project.projectCode,
            donorName: ctx.project.donorName,
            implementingOrganization: ctx.project.implementingOrganization,
            partnerOrganization: ctx.project.partnerOrganization,
            country: ctx.project.country,
            location: [ctx.project.region, ctx.project.district].filter(Boolean).join(", ") || undefined,
            sector: ctx.project.sector,
            description: ctx.project.description,
            budget: ctx.project.budgetAmount !== undefined ? `${ctx.project.budgetAmount} ${ctx.project.budgetCurrency ?? "USD"}` : undefined,
            reportingFrequency: ctx.project.reportingFrequency,
          }
        : undefined,
      period: ctx?.period
        ? {
            reportType: ctx.period.reportType,
            startDate: ctx.period.startDate,
            endDate: ctx.period.endDate,
            deadline: ctx.period.deadline,
            readinessScore: ctx.period.readinessScore,
          }
        : undefined,
      template: ctx?.template
        ? {
            templateName: ctx.template.templateName,
            donorName: ctx.template.donorName,
            language: ctx.template.language,
            requiredAnnexes: ctx.template.requiredAnnexes,
            notes: ctx.template.notes,
            version: ctx.template.version,
          }
        : undefined,
      profile: {
        tone: input.reportingProfileSnapshot.tone,
        language: input.reportingProfileSnapshot.language,
        formattingRules: input.reportingProfileSnapshot.formattingRules,
      },
    };
  }
}

function groupByEvidence(
  retrieved: RetrievedEvidence[],
  input: GenerateReportDraftInput,
  maxPackages: number,
  maxChunks: number,
  maxChars: number,
): AiReporterSectionRequest["retrievedEvidence"] {
  const byId = new Map(input.evidencePackages.map((p) => [p.evidenceId, p]));
  const grouped = new Map<string, AiReporterSectionRequest["retrievedEvidence"][number]>();
  for (const item of retrieved) {
    const pkg = byId.get(item.evidenceId);
    if (!pkg) continue;
    let entry = grouped.get(item.evidenceId);
    if (!entry) {
      if (grouped.size >= maxPackages) continue;
      entry = {
        evidenceId: item.evidenceId,
        title: pkg.title,
        evidenceType: pkg.evidenceType,
        verificationStatus: pkg.verificationStatus,
        confidentialityLevel: pkg.confidentialityLevel,
        chunks: [],
      };
      grouped.set(item.evidenceId, entry);
    }
    if (entry.chunks.length < maxChunks) {
      entry.chunks.push({ chunkId: item.chunkId, text: item.chunkText.slice(0, maxChars) });
    }
  }
  return Array.from(grouped.values());
}

function mapClaims(claims: AiReporterSectionResponse["claims"]): ReportClaimDraft[] {
  const result: ReportClaimDraft[] = [];
  for (const c of claims ?? []) {
    if (!c || typeof c.text !== "string" || !c.text.trim()) continue;
    const type = CLAIM_TYPES.has(c.type) ? (c.type as ReportClaimDraft["type"]) : "FACTUAL";
    const proposedSources: ReportClaimDraft["proposedSources"] = [];
    for (const s of c.proposedSources ?? []) {
      if (s && typeof s.evidenceId === "string" && typeof s.chunkId === "string") {
        proposedSources.push({ evidenceId: s.evidenceId, chunkId: s.chunkId, sourceText: s.sourceText ?? "" });
      }
    }
    result.push({ text: c.text.trim(), type, proposedSources });
  }
  return result;
}

function mapReferences(refs: AiReporterSectionResponse["sourceReferences"]): SourceReference[] {
  const result: SourceReference[] = [];
  for (const r of refs ?? []) {
    if (!r || typeof r.id !== "string" || !r.id) continue;
    const type = REFERENCE_TYPES.has(r.type) ? (r.type as SourceReference["type"]) : "indicator";
    result.push({ type, id: r.id, label: r.label });
  }
  return result;
}

// --------------------------------------------------------------------------- //
// AI Reporter 2 — typed artifact / QA / chart / delta mapping
// --------------------------------------------------------------------------- //

function mapSourceReferences(
  refs: ReadonlyArray<AiReporterSourceReference | undefined> | undefined,
): SourceReference[] {
  const result: SourceReference[] = [];
  for (const r of refs ?? []) {
    if (!r || typeof r.id !== "string" || !r.id) continue;
    const t = r.type;
    const safeType = (VALID_REFERENCE_TYPES.has(t as (typeof VALID_REFERENCE_TYPES extends Set<infer U> ? U : never))
      ? t
      : "indicator") as SourceReference["type"];
    result.push({ type: safeType, id: r.id, label: r.label });
  }
  return result;
}

function mapTablePayload(payload: AiReporterChartPayload | undefined | unknown): GeneratedTablePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(p.columns) || !Array.isArray(p.rows)) return null;
  const columns: GeneratedTablePayload["columns"] = [];
  for (const c of p.columns) {
    if (!c || typeof (c as { key?: unknown }).key !== "string" || typeof (c as { label?: unknown }).label !== "string") continue;
    columns.push({
      key: (c as { key: string }).key,
      label: (c as { label: string }).label,
      unit: typeof (c as { unit?: unknown }).unit === "string" ? (c as { unit: string }).unit : undefined,
    });
  }
  if (columns.length === 0) return null;
  const rows: GeneratedTablePayload["rows"] = [];
  for (const r of p.rows) {
    if (!r || !Array.isArray((r as { cells?: unknown }).cells)) continue;
    const cells: Array<string | number | null> = [];
    for (const cell of (r as { cells: unknown[] }).cells) {
      if (cell === null || cell === undefined) cells.push(null);
      else if (typeof cell === "number" || typeof cell === "string") cells.push(cell);
      else cells.push(String(cell));
    }
    rows.push({
      cells,
      sourceReferences: mapSourceReferences((r as { sourceReferences?: AiReporterSourceReference[] }).sourceReferences),
    });
  }
  if (rows.length === 0) return null;
  return { columns, rows };
}

function mapChartPayload(payload: AiReporterChartPayload | undefined): GeneratedChartSpec | null {
  if (!payload) return null;
  if (typeof payload.type !== "string" || typeof payload.dataBinding !== "string") return null;
  if (typeof payload.title !== "string" || typeof payload.caption !== "string") return null;
  if (!Array.isArray(payload.categories) || !Array.isArray(payload.series)) return null;
  const series: GeneratedChartSpec["series"] = [];
  for (const s of payload.series) {
    if (!s || typeof s.name !== "string" || !Array.isArray(s.data)) continue;
    series.push({
      name: s.name,
      data: s.data.map((d) => (d === null || d === undefined ? null : (typeof d === "string" || typeof d === "number" ? d : String(d)))),
      sourceReferences: mapSourceReferences(s.sourceReferences),
    });
  }
  if (series.length === 0) return null;
  return {
    type: payload.type as GeneratedChartSpec["type"],
    dataBinding: payload.dataBinding as GeneratedChartSpec["dataBinding"],
    unit: typeof payload.unit === "string" ? payload.unit : undefined,
    title: payload.title,
    caption: payload.caption,
    categories: payload.categories.map((c) => String(c)),
    series,
    sourceReferences: mapSourceReferences(payload.sourceReferences),
  };
}

function mapListPayload(payload: unknown): GeneratedListPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { ordered?: unknown; items?: unknown };
  if (!Array.isArray(p.items)) return null;
  const items: GeneratedListPayload["items"] = [];
  for (const it of p.items) {
    if (!it || typeof (it as { text?: unknown }).text !== "string") continue;
    items.push({
      text: (it as { text: string }).text,
      sourceReferences: mapSourceReferences((it as { sourceReferences?: AiReporterSourceReference[] }).sourceReferences),
    });
  }
  if (items.length === 0) return null;
  return { ordered: p.ordered === true, items };
}

function mapKeyValuePayload(payload: unknown): GeneratedKeyValuePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { entries?: unknown };
  if (!Array.isArray(p.entries)) return null;
  const entries: GeneratedKeyValuePayload["entries"] = [];
  for (const e of p.entries) {
    if (!e) continue;
    const k = (e as { key?: unknown }).key;
    const v = (e as { value?: unknown }).value;
    if (typeof k !== "string" || typeof v !== "string") continue;
    entries.push({
      key: k,
      value: v,
      sourceReferences: mapSourceReferences((e as { sourceReferences?: AiReporterSourceReference[] }).sourceReferences),
    });
  }
  if (entries.length === 0) return null;
  return { entries };
}

function mapQaItem(payload: AiReporterQaPayload): GeneratedQaItem | null {
  if (!payload || typeof payload.question !== "string" || typeof payload.answer !== "string") return null;
  const refs = mapSourceReferences(payload.sourceReferences);
  if (refs.length === 0) return null;
  return { question: payload.question, answer: payload.answer, sourceReferences: refs };
}

function mapDeltaPayload(payload: AiReporterDeltaPayload | undefined): GeneratedDelta | null {
  if (!payload) return null;
  if (typeof payload.metric !== "string" || typeof payload.fromValue !== "string" || typeof payload.toValue !== "string") return null;
  if (typeof payload.direction !== "string") return null;
  if (!["UP", "DOWN", "FLAT"].includes(payload.direction)) return null;
  if (typeof payload.evidenceSummary !== "string") return null;
  const refs = mapSourceReferences(payload.sourceReferences);
  if (refs.length === 0) return null;
  return {
    metric: payload.metric,
    fromValue: payload.fromValue,
    toValue: payload.toValue,
    direction: payload.direction as GeneratedDelta["direction"],
    evidenceSummary: payload.evidenceSummary,
    sourceReferences: refs,
  };
}

function mapArtifacts(artifacts: ReadonlyArray<AiReporterArtifact> | undefined): GeneratedArtifact[] {
  if (!artifacts) return [];
  const out: GeneratedArtifact[] = [];
  let ordinal = 0;
  for (const art of artifacts) {
    if (!art || typeof art.kind !== "string" || !ARTIFACT_KINDS.has(art.kind as GeneratedArtifact["kind"])) continue;
    const kind = art.kind as GeneratedArtifact["kind"];
    const refs = mapSourceReferences(art.sourceReferences);
    const caption = typeof art.caption === "string" ? art.caption : undefined;
    const ord = typeof art.ordinal === "number" && Number.isFinite(art.ordinal) ? Math.max(0, Math.floor(art.ordinal)) : ordinal;
    ordinal = ord + 1;
    if (kind === "TABLE") {
      const payload = mapTablePayload(art.payload as unknown);
      if (!payload) continue;
      out.push({ kind, caption, ordinal: ord, payload, sourceReferences: refs });
    } else if (kind === "CHART") {
      const payload = mapChartPayload(art.payload as AiReporterChartPayload);
      if (!payload) continue;
      out.push({ kind, caption, ordinal: ord, payload, sourceReferences: refs });
    } else if (kind === "LIST") {
      const payload = mapListPayload(art.payload);
      if (!payload) continue;
      out.push({ kind, caption, ordinal: ord, payload, sourceReferences: refs });
    } else if (kind === "KEY_VALUE") {
      const payload = mapKeyValuePayload(art.payload);
      if (!payload) continue;
      out.push({ kind, caption, ordinal: ord, payload, sourceReferences: refs });
    } else if (kind === "QA") {
      const qa = mapQaItem(art.payload as AiReporterQaPayload);
      if (!qa) continue;
      out.push({ kind, caption, ordinal: ord, payload: qa, sourceReferences: refs });
    } else if (kind === "DELTA") {
      const delta = mapDeltaPayload(art.payload as AiReporterDeltaPayload);
      if (!delta) continue;
      out.push({ kind, caption, ordinal: ord, payload: delta, sourceReferences: refs });
    }
  }
  return out;
}

function mapQa(qa: ReadonlyArray<AiReporterQaPayload> | undefined): GeneratedQaItem[] {
  if (!qa) return [];
  const out: GeneratedQaItem[] = [];
  for (const item of qa) {
    const mapped = mapQaItem(item);
    if (mapped) out.push(mapped);
  }
  return out;
}
