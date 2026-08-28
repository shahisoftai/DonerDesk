import { createHash } from "node:crypto";
import type {
  IReportDraftGenerator,
  GenerateReportDraftInput,
  GeneratedDraftResult,
  GeneratedSection,
  GeneratedSectionResult,
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
  AiReporterActivity,
  AiReporterContext,
  AiReporterFinding,
  AiReporterIndicatorUpdate,
  AiReporterPriorNarrative,
  AiReporterSectionRequest,
  AiReporterSectionResponse,
  IWorkerClient,
} from "./ai-reporter-worker.js";
import type { IPriorPeriodService } from "./prior-period.js";

const CLAIM_TYPES = new Set(["NUMERIC", "FACTUAL", "CAUSAL", "QUALITATIVE"]);
const REFERENCE_TYPES = new Set(["evidence", "activity", "indicator", "template"]);

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
    for (const section of input.reportPlan.sections) {
      const result = await this.generateSection(input, section);
      if (result.usedFallback) {
        // A single failed section degrades the whole draft to fallback so the
        // handler never meters it as a real AI draft.
        return {
          sections: sections.length > 0 ? sections : [result.section],
          usedFallback: true,
          fallbackReason: result.fallbackReason,
        };
      }
      sections.push(result.section);
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

      return {
        section: {
          sectionId: payload.sectionId || section.templateSectionId || `section-${section.title}`,
          title: payload.title || section.title,
          content,
          claims: mapClaims(payload.claims),
          sourceReferences: mapReferences(payload.sourceReferences),
        },
        usedFallback: false,
        telemetry: {
          inputTokens: payload.telemetry?.inputTokens ?? 0,
          outputTokens: payload.telemetry?.outputTokens ?? 0,
          latencyMs: Date.now() - startedAt,
          promptHash: payload.telemetry?.promptHash ?? "",
          responseHash: payload.telemetry?.responseHash,
          responseChars: content.length,
          parseOutcome: "VALID",
        },
      };
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
