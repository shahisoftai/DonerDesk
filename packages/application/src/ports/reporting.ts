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
  ReportRevision,
  Assertion,
  AssertionType,
  Materiality,
  NumericAtom,
  VerificationReasonCode,
  SubmissionSnapshot,
  ReportingRequirementPack,
  AwardReportingOverride,
  ResolvedReportingRequirements,
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

/**
 * Serializable snapshot of an activity update consumed at generation time.
 * Carries the narrative fields (summary, achievements, challenges, lessons,
 * next steps) plus participant counts and linked evidence so the narrator can
 * weave the activity record into the report instead of only collecting its
 * evidence IDs.
 */
export interface ActivityGenerationContext {
  activityId: string;
  activityTitle: string;
  activityDate: Date;
  location?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  summary: string;
  achievements: string;
  challenges: string;
  lessonsLearned: string;
  nextSteps: string;
  attachedEvidenceIds: string[];
  status: string;
}

/**
 * Serializable snapshot of an indicator update consumed at generation time.
 * Carries the raw achievement strings, comments, data source and linked
 * evidence so the narrator can describe what was recorded without recomputing
 * the deterministic finding.
 */
export interface IndicatorUpdateGenerationContext {
  indicatorId: string;
  indicatorCode: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments?: string;
  dataSource?: string;
  attachedEvidenceIds: string[];
  verificationStatus: string;
}

/**
 * Serializable snapshot of the project consumed at generation time. Carries
 * identity, geographic, sector, duration, budget, and description context so
 * the narrator can open a report with a proper project header and tailor
 * language to the donor and implementing organization.
 */
export interface ProjectGenerationContext {
  title: string;
  projectCode: string;
  donorName: string;
  implementingOrganization: string;
  partnerOrganization?: string;
  country: string;
  region?: string;
  district?: string;
  sector: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  reportingFrequency: string;
}

/**
 * Serializable snapshot of the reporting period consumed at generation time.
 * Carries the report type, period dates, deadlines, and readiness score so
 * the narrator can scope the report and surface compliance context.
 */
export interface PeriodGenerationContext {
  reportType: string;
  startDate: string;
  endDate: string;
  deadline?: string;
  internalReviewDeadline?: string;
  readinessScore?: number;
  daysUntilDeadline?: number;
}

/**
 * Serializable snapshot of the locked donor template consumed at generation
 * time. Carries the donor identity, language, required annexes, and notes so
 * the narrator can align the report with donor expectations.
 */
export interface TemplateGenerationContext {
  templateName: string;
  donorName: string;
  language: string;
  requiredAnnexes: string[];
  notes?: string;
  version: number;
}

/**
 * Aggregate report-level context passed to the narrator: the project the
 * report belongs to, the reporting period it covers, and the donor template
 * it must satisfy. Built by the application handler from the domain entities;
 * consumed by infrastructure narrators.
 */
export interface ReportGenerationContext {
  project: ProjectGenerationContext;
  period: PeriodGenerationContext;
  template?: TemplateGenerationContext;
}

export interface GenerateReportDraftInput {
  reportPlan: ReportPlan;
  verifiedFindings: VerifiedFinding[];
  evidencePackages: EvidencePackage[];
  activities: ActivityGenerationContext[];
  indicatorUpdates: IndicatorUpdateGenerationContext[];
  reportingProfileSnapshot: ReportingProfileSnapshot;
  generationRunId: string;
  /** Optional report/project/period/template context. Absent for legacy callers. */
  reportContext?: ReportGenerationContext;
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

export interface GeneratedDraftResult {
  sections: GeneratedSection[];
  /**
   * True when the provider failed (timeout, HTTP error, unparseable response)
   * and the generator silently fell back to the deterministic stub. Callers
   * must NOT meter or bill a real AI run when this is true — the draft was not
   * produced by the LLM.
   */
  usedFallback: boolean;
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
   * output carries structured claims that are verified downstream. The result
   * reports whether the configured provider actually produced the content or
   * a stub fallback was used.
   */
  generateDraft(input: GenerateReportDraftInput): Promise<GeneratedDraftResult>;

  /**
   * Rewrites or shortens an existing section while preserving its facts and
   * source references. `mode` selects the transformation; `audience` adapts
   * tone for the reader. Implementations must never invent claims. Exact
   * prompt and response hashes are returned for reproduction and audit.
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
    promptHash?: string;
    responseHash?: string;
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

export type EntailmentVerdict = "SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT" | "UNCERTAIN";

export interface EntailmentResult {
  verdict: EntailmentVerdict;
  citedSpans: Array<{ evidenceId: string; chunkId: string; sourceText: string }>;
  confidence: number;
  reasonCode: VerificationReasonCode | null;
}

export interface ClaimVerification {
  claimId: string;
  result: VerificationResult;
  detail: string;
  matchedFinding?: VerifiedFinding;
  tierUsed: 1 | 2 | 3 | 4 | 5;
  /** Structured failure reasons; gate decisions consume these, never the detail string. */
  reasonCodes: VerificationReasonCode[];
  /** Numeric atoms verified for numeric assertions. */
  numericAtoms?: NumericAtom[];
  entailment?: EntailmentResult;
}

/**
 * Tiered claim verifier. Deterministic tiers (source integrity, numeric atom
 * binding, unit/period/entity consistency, entailment) run in cost order and
 * short-circuit LLM cost; LLM-backed entailment and elevated causal review sit
 * behind provider swap points. A failed verification is never silently
 * converted into a passed state.
 */
export interface IClaimVerifier {
  verify(input: {
    claim: ReportClaimDraft;
    findings: VerifiedFinding[];
    evidencePackages: EvidencePackage[];
  }): Promise<Result<ClaimVerification, DomainError>>;
}

/**
 * Verifies that every cited source still points at the exact evidence bytes
 * snapshotted at generation time. Runs before semantic verification.
 */
export interface EvidenceIntegrityResult {
  valid: boolean;
  reasons: VerificationReasonCode[];
  detail: string;
}

export interface IEvidenceIntegrityVerifier {
  verify(input: {
    sources: Array<{ evidenceId: string; chunkId: string; sourceText: string; evidenceHash?: string }>;
    evidencePackages: EvidencePackage[];
  }): Promise<Result<EvidenceIntegrityResult, DomainError>>;
}

export interface RetrievedEvidence {
  evidenceId: string;
  chunkId: string;
  chunkText: string;
  score: number;
}

export interface RetrievalRequest {
  sectionTitle: string;
  entities: string[];
  dates: string[];
  indicatorCodes: string[];
  evidenceType?: string;
  verificationStatus?: string;
  maxTokens?: number;
}

export interface IEvidenceRetriever {
  retrieve(input: RetrievalRequest): Promise<Result<RetrievedEvidence[], DomainError>>;
}

export interface IEntailmentVerifier {
  verify(input: {
    assertionText: string;
    assertionType: AssertionType;
    evidence: RetrievedEvidence[];
  }): Promise<Result<EntailmentResult, DomainError>>;
}

export interface ICausalReviewPolicy {
  requiresHumanDecision(type: AssertionType, verdict: EntailmentVerdict): boolean;
  reasonCode(): VerificationReasonCode;
}

export interface ExtractedAssertion extends Assertion {}

export interface AssertionExtractionInput {
  content: string;
  writerClaims: ReportClaimDraft[];
}

/**
 * Extracts structured assertions from final normalized content. Implementations
 * must not trust only the writer-provided claims array: every material
 * statement in the content must enter the assurance pipeline.
 */
export interface IAssertionExtractor {
  extract(input: AssertionExtractionInput): Promise<Result<Assertion[], DomainError>>;
}

export interface IReportRevisionRepository {
  create(r: ReportRevision): Promise<Result<ReportRevision>>;
  update(r: ReportRevision): Promise<Result<ReportRevision>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportRevision | null>>;
  findBySection(sectionId: string, tenantId: TenantId): Promise<Result<ReportRevision[]>>;
  findByDraft(draftId: string, tenantId: TenantId): Promise<Result<ReportRevision[]>>;
  findCurrentForSection(sectionId: string, tenantId: TenantId): Promise<Result<ReportRevision | null>>;
  /** Removes all revisions bound to a section (used when a section is deleted). */
  deleteBySection(sectionId: string, tenantId: TenantId): Promise<Result<void>>;
  createNextForSection(input: {
    tenantId: TenantId;
    sectionId: string;
    draftId: string;
    content: string;
    contentHash: string;
    changeOrigin: ReportRevision["changeOrigin"];
    actorId: string;
    modelId?: string;
    promptVersion?: number;
    generationRunId?: string;
  }): Promise<Result<ReportRevision>>;
}

export interface ISubmissionSnapshotRepository {
  create(s: SubmissionSnapshot): Promise<Result<SubmissionSnapshot>>;
  update(s: SubmissionSnapshot): Promise<Result<SubmissionSnapshot>>;
  findById(id: string, tenantId: TenantId): Promise<Result<SubmissionSnapshot | null>>;
  findLatestForDraft(draftId: string, tenantId: TenantId): Promise<Result<SubmissionSnapshot | null>>;
}

export interface IRequirementPackRepository {
  create(pack: ReportingRequirementPack): Promise<Result<ReportingRequirementPack>>;
  update(pack: ReportingRequirementPack): Promise<Result<ReportingRequirementPack>>;
  findById(id: string, tenantId: string | undefined): Promise<Result<ReportingRequirementPack | null>>;
  findActiveByMechanism(input: {
    donorKey: string;
    mechanismKey: string;
    reportType: string;
    language: string;
    tenantId?: string;
  }): Promise<Result<ReportingRequirementPack | null>>;
}

export interface IAwardOverrideRepository {
  create(o: AwardReportingOverride): Promise<Result<AwardReportingOverride>>;
  update(o: AwardReportingOverride): Promise<Result<AwardReportingOverride>>;
  findById(id: string, tenantId: TenantId): Promise<Result<AwardReportingOverride | null>>;
  findActiveForProject(projectId: string, tenantId: TenantId, effectiveDate: Date): Promise<Result<AwardReportingOverride[]>>;
}

export interface IResolvedRequirementsRepository {
  create(r: ResolvedReportingRequirements): Promise<Result<ResolvedReportingRequirements>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ResolvedReportingRequirements | null>>;
  findLatestForPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ResolvedReportingRequirements | null>>;
}

export interface IRequirementResolver {
  resolve(input: {
    tenantId: TenantId;
    reportingPeriodId: string;
    effectiveDate: Date;
  }): Promise<Result<ResolvedReportingRequirements, DomainError>>;
}

export interface RequirementEvaluationInput {
  requirements: ResolvedReportingRequirements["snapshot"];
  sectionTitles: string[];
  /** Parallel array of resolved requirement keys each section satisfies. */
  sectionRequirementKeys: string[][];
  /** Parallel array of section contents (for word-limit checks). */
  sectionContents: string[];
}

export interface RequirementEvaluationResult {
  satisfied: string[];
  unmet: string[];
  blocking: Array<{ key: string; reason: string }>;
}

/**
 * Pluggable requirement evaluator (Phase 5). Computes which resolved
 * requirements are satisfied by the report plan sections and flags unmet
 * mandatory requirements and word-limit violations. Deterministic by default;
 * an LLM-judge evaluator may be added behind the same port.
 */
export interface IRequirementEvaluator {
  evaluate(input: RequirementEvaluationInput): Promise<Result<RequirementEvaluationResult, DomainError>>;
}

export interface IReportRevisionService {
  /**
   * Centralizes every content mutation (generation, manual edit, rewrite,
   * auto-fix). Creates a new UNASSESSED revision, repoints the section at it,
   * and persists both. Prior verification is never carried forward.
   */
  commitChange(input: {
    tenantId: TenantId;
    section: ReportSection;
    content: string;
    sourceReferences: SourceReference[];
    unsupportedClaims: string[];
    changeOrigin: ReportRevision["changeOrigin"];
    actorId: string;
    modelId?: string;
    promptVersion?: number;
    generationRunId?: string;
  }): Promise<Result<ReportRevision, DomainError>>;
}

export interface AssessRevisionResult {
  revisionId: string;
  assuranceState: string;
  claims: ReportClaim[];
  coverage: { totalAssertions: number; materialAssertions: number; complete: boolean; blockingReasons: string[] };
  blocked: boolean;
  blockReasons: string[];
}

/**
 * Runs the full assurance pipeline for one revision: extract assertions from
 * final content (never only the writer's claims), reconcile writer claims,
 * verify every material assertion, persist revision-bound claims, and set the
 * revision's assurance state.
 */
export interface IReportAssuranceService {
  assessRevision(input: {
    ctx: { tenantId: TenantId; userId: string };
    sectionId: string;
    revisionId: string;
    writerClaims?: ReportClaimDraft[];
    /** Pre-computed findings; computed by the service when omitted. */
    findings?: VerifiedFinding[];
    /** Pre-built evidence packages; built by the service when omitted. */
    evidencePackages?: EvidencePackage[];
  }): Promise<Result<AssessRevisionResult, DomainError>>;
}

export interface IReportPlanRepository {
  create(p: ReportPlan): Promise<Result<ReportPlan>>;
  update(p: ReportPlan): Promise<Result<ReportPlan>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportPlan | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ReportPlan[]>>;
  /**
   * Creates the plan with the next free version for the reporting period,
   * retrying on concurrent version collisions. Prefer this over manual
   * max()+1 + create when concurrent regenerations are possible.
   */
  createNextVersion?(p: ReportPlan): Promise<Result<ReportPlan>>;
}

export interface IReportClaimRepository {
  create(c: ReportClaim): Promise<Result<ReportClaim>>;
  update(c: ReportClaim): Promise<Result<ReportClaim>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportClaim | null>>;
  findByDraft(draftId: string, tenantId: TenantId): Promise<Result<ReportClaim[]>>;
  findBySection(sectionId: string, tenantId: TenantId): Promise<Result<ReportClaim[]>>;
  /** Removes all claims bound to a section (used when a new revision supersedes them). */
  deleteBySection(sectionId: string, tenantId: TenantId): Promise<Result<void>>;
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
