import type {
  Result,
  TenantId,
  DomainError,
  ReportPlan,
  VerifiedFinding,
  ReportClaim,
  ReportGenerationRun,
  DonorTemplateMapping,
  ClaimType,
  SourceReference,
  VerificationResult,
  WordCountOverride,
  ProfileTone,
  TemplateSection,
} from "@donordesk/domain";
import type { ReportingPeriod, ReportDraft, ReportSection } from "@donordesk/domain";

export interface IReportingPeriodRepository {
  create(p: ReportingPeriod): Promise<Result<ReportingPeriod>>;
  update(p: ReportingPeriod): Promise<Result<ReportingPeriod>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportingPeriod | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ReportingPeriod[]>>;
  /**
   * Adjacent reporting periods that started before the given period, newest
   * first. The deterministic analyst uses these for period-on-period deltas.
   */
  findPreviousPeriods(projectId: string, beforeReportingPeriodId: string, tenantId: TenantId, limit?: number): Promise<Result<ReportingPeriod[]>>;
}

export interface IReportDraftRepository {
  create(d: ReportDraft): Promise<Result<ReportDraft>>;
  update(d: ReportDraft): Promise<Result<ReportDraft>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportDraft | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ReportDraft[]>>;
}

export interface IReportSectionRepository {
  create(s: ReportSection): Promise<Result<ReportSection>>;
  update(s: ReportSection): Promise<Result<ReportSection>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportSection | null>>;
  findByReportDraft(reportDraftId: string, tenantId: TenantId): Promise<Result<ReportSection[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

// ---------------------------------------------------------------------------
// Report intelligence contracts
// ---------------------------------------------------------------------------

export interface EvidenceChunkPackage {
  chunkId: string;
  text: string;
  tokenCount: number;
  chunkIndex: number;
}

export interface EvidencePackage {
  evidenceId: string;
  title: string;
  fileName: string;
  evidenceType: string;
  verificationStatus: string;
  confidentialityLevel: string;
  extractedText?: string;
  chunks: EvidenceChunkPackage[];
  /** Hash of the exact bytes consumed at generation time. */
  evidenceHash: string;
  evidenceUpdatedAt: Date;
  chunkerVersion: string;
}

export interface ReportingProfileSnapshot {
  tone: ProfileTone;
  language: string;
  formattingRules: string[];
  sectionOverrides: Record<string, WordCountOverride>;
}

export interface GenerateReportDraftInput {
  reportPlan: ReportPlan;
  verifiedFindings: VerifiedFinding[];
  evidencePackages: EvidencePackage[];
  reportingProfileSnapshot: ReportingProfileSnapshot;
  generationRunId: string;
}

export interface ReportClaimDraft {
  text: string;
  type: ClaimType;
  proposedSources: Array<{ evidenceId: string; chunkId: string; sourceText: string }>;
}

export interface GeneratedSection {
  sectionId: string;
  title: string;
  content: string;
  claims: ReportClaimDraft[];
  sourceReferences: SourceReference[];
}

export interface LlmGeneratorModelInfo {
  modelId: string;
  modelVersion: string;
  promptVersion: number;
}

export interface IReportDraftGenerator {
  /**
   * Identifies the model powering this generator. Used for accurate run
   * snapshots and billing records. The stub always returns stub values.
   */
  readonly model: LlmGeneratorModelInfo;

  /**
   * Drafts sections from a report plan and verified findings. The LLM (or
   * stub) is strictly a narrator: it receives findings the deterministic
   * analyst already computed and must never recompute or invent numbers. The
   * output carries structured claims that are verified downstream.
   */
  generateDraft(input: GenerateReportDraftInput): Promise<GeneratedSection[]>;

  /**
   * Rewrites or shortens an existing section while preserving its facts and
   * source references. `mode` selects the transformation; `audience` adapts
   * tone for the reader. Implementations must never invent claims.
   */
  rewriteSection(input: {
    sectionTitle: string;
    content: string;
    mode: "REWRITE" | "SHORTEN";
    audience: "DONOR" | "INTERNAL" | "GENERAL";
    instructions?: string;
    sourceReferences: SourceReference[];
  }): Promise<{
    content: string;
    unsupportedClaims: string[];
  }>;
}

/**
 * Deterministic indicator analytics. No LLM involvement; the sole authority
 * over indicator mathematics. Backed by the domain indicator calculator.
 */
export interface IIndicatorAnalyticsService {
  computeFindings(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: TenantId;
  }): Promise<Result<VerifiedFinding[], DomainError>>;
}

export interface IReportPlanner {
  plan(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: TenantId;
    templateSections: TemplateSection[];
    templateVersion: number;
    profileVersion: number;
    reportingProfileSnapshot: ReportingProfileSnapshot;
  }): Promise<Result<ReportPlan, DomainError>>;
}

export interface ClaimVerification {
  claimId: string;
  result: VerificationResult;
  detail: string;
  matchedFinding?: VerifiedFinding;
  tierUsed: 1 | 2 | 3 | 4 | 5;
}

/**
 * Tiered claim verifier. Deterministic tiers (numeric exact match, unit and
 * period match) run first and short-circuit LLM cost; LLM-backed entailment
 * and elevated causal review sit behind provider swap points.
 */
export interface IClaimVerifier {
  verify(input: {
    claim: ReportClaimDraft;
    findings: VerifiedFinding[];
    evidencePackages: EvidencePackage[];
  }): Promise<Result<ClaimVerification, DomainError>>;
}

export interface IReportPlanRepository {
  create(p: ReportPlan): Promise<Result<ReportPlan>>;
  update(p: ReportPlan): Promise<Result<ReportPlan>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportPlan | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ReportPlan[]>>;
}

export interface IReportClaimRepository {
  create(c: ReportClaim): Promise<Result<ReportClaim>>;
  update(c: ReportClaim): Promise<Result<ReportClaim>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportClaim | null>>;
  findByDraft(draftId: string, tenantId: TenantId): Promise<Result<ReportClaim[]>>;
  findBySection(sectionId: string, tenantId: TenantId): Promise<Result<ReportClaim[]>>;
}

export interface IGenerationRunRepository {
  create(run: ReportGenerationRun): Promise<Result<ReportGenerationRun>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportGenerationRun | null>>;
  findByDraft(draftId: string, tenantId: TenantId): Promise<Result<ReportGenerationRun[]>>;
}

export interface IDonorTemplateMappingRepository {
  create(m: DonorTemplateMapping): Promise<Result<DonorTemplateMapping>>;
  findById(id: string, tenantId: TenantId): Promise<Result<DonorTemplateMapping | null>>;
  findByTemplate(templateId: string, tenantId: TenantId): Promise<Result<DonorTemplateMapping[]>>;
  findByTemplateAndVersion(templateId: string, version: number, tenantId: TenantId): Promise<Result<DonorTemplateMapping | null>>;
}

/**
 * Builds generation-ready evidence packages: chunks the source text and
 * snapshots the exact bytes (hash + updatedAt + chunker version) consumed at
 * generation time. Implemented in infrastructure with EvidenceChunker.
 */
export interface IEvidencePackageBuilder {
  build(input: { tenantId: TenantId; evidenceIds: string[] }): Promise<Result<EvidencePackage[], DomainError>>;
}
