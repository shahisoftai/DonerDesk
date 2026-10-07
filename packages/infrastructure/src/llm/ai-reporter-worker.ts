import type { DomainError, Result } from "@donordesk/domain";

/**
 * TypeScript mirror of the Python AI Reporter's wire contract. The worker is a
 * stateless prose engine: it receives a section brief plus pre-retrieved
 * evidence and returns a GeneratedSection-shaped response. The deterministic
 * assurance pipeline remains the final authority.
 */

export interface AiReporterSectionBrief {
  title: string;
  /** English title for section-role detection when `title` is translated (blueprint sections). */
  canonicalTitle?: string;
  inputType?: string;
  minWords?: number;
  maxWords?: number;
  mandatoryQuestions: string[];
  evidenceNeeds: string[];
  relatedLogframeElement?: string;
  /** AI Reporter 2 — pre-extracted typed numeric rows (Py. `NumericTableRetriever`). */
  numericTable?: AiReporterNumericRow[];
  /** AI Reporter 2 — concise summaries of already-written sibling sections. */
  priorSectionsSummary?: string[];
  /** AI Reporter 2 — deterministic chart suggestion (null when none applies). */
  chartSuggestion?: AiReporterChartPayload | null;
  /** AI Reporter 2 — per-inputType outline slots the writer must fill. */
  outlineSlots?: AiReporterOutlineSlot[];
  /** AI Reporter 2 — when true the writer must emit a TABLE artifact. */
  mandatesTable?: boolean;
  /** AI Reporter 2 — when true the writer must emit a CHART artifact. */
  mandatesChart?: boolean;
  /**
   * Quality remediation WS1 — donor requirement guidance stamped on the plan
   * section (from the resolved requirement snapshot). Must stay in lockstep
   * with the Python `SectionBrief` model (extra="forbid").
   */
  requirementGuidance?: string[];
  /**
   * Quality v4 — section-specific editorial guidance rendered by
   * `buildSectionSpecificGuidance` (single SSOT shared with the legacy narrator).
   */
  sectionGuidance?: string[];
  /**
   * Quality v4 — the section synthesises the drafted report (executive
   * summary); `priorSectionsSummary` then carries the sections to summarise.
   */
  synthesis?: boolean;
  /**
   * Report Editor B7 — the author's instruction when one section is
   * regenerated. Mirrors Python `SectionBrief.userInstruction`; absent for
   * full drafts (prompts then stay byte-stable).
   */
  userInstruction?: string;
  /** A compliance section's only source: the reporting officer's statement. Mirrors Python `SectionBrief.officerNote`. */
  officerNote?: string;
  /**
   * Template Manager v2 — the donor template's own guidance for this section,
   * required table shapes, and the organisation's standing guidance. Mirror
   * Python `SectionBrief` (extra="forbid"); only sent when present.
   */
  donorInstructions?: string;
  requiredTables?: Array<{ title: string; columns: string[]; notes?: string }>;
  authorInstructions?: string;
  pageLimit?: number;
}


export interface AiReporterNumericRow {
  indicatorId: string;
  indicatorName?: string;
  period?: string;
  value: string;
  unit?: string;
  evidenceId: string;
}

export interface AiReporterOutlineSlot {
  id: string;
  intent: string;
  required: boolean;
  hint?: string;
}

export interface AiReporterContextProject {
  title?: string;
  projectCode?: string;
  donorName?: string;
  implementingOrganization?: string;
  partnerOrganization?: string;
  country?: string;
  location?: string;
  sector?: string;
  description?: string;
  budget?: string;
  reportingFrequency?: string;
}

export interface AiReporterContextPeriod {
  reportType?: string;
  /** Focus of an activity/situation/custom report (absent for cadence reports). */
  scope?: string;
  startDate?: string;
  endDate?: string;
  deadline?: string;
}

export interface AiReporterContextTemplate {
  templateName?: string;
  donorName?: string;
  language?: string;
  requiredAnnexes: string[];
  notes?: string;
  version?: number;
  /** Template Manager v2 — report-wide donor requirements (absent = not sent). */
  reportTitle?: string;
  generalInstructions?: string[];
  formattingRules?: string[];
  submissionInstructions?: string[];
  complianceRequirements?: string[];
  indicatorRequirements?: string[];
}

export interface AiReporterContextStory {
  achievements?: string;
  challenges?: string;
  varianceExplanations?: string;
  adaptations?: string;
  lessons?: string;
}

export interface AiReporterContext {
  project?: AiReporterContextProject;
  period?: AiReporterContextPeriod;
  template?: AiReporterContextTemplate;
  profile?: { tone: string; language: string; formattingRules: string[] };
  /** Quality v4 — officer "Tell the Story" narrative context. */
  story?: AiReporterContextStory;
  /** Quality v4 — exact donor attribution lines from the domain visibility catalog. */
  visibility?: string[];
  /** Verified financial figures (balance and burn rate already computed); absent unless the project uses them. */
  finance?: AiReporterContextFinance;
  /** Contract v5: the report's own section titles and indicator codes (the only labels the writer may name). */
  structure?: { sectionTitles: string[]; indicatorCodes: string[] };
  /** Contract v5: indicators with no figure this period. */
  notMeasured?: Array<{ indicatorCode: string; indicatorName?: string; frequency?: string }>;
}

export interface AiReporterContextFinance {
  currency: string;
  budget: string;
  expenditure: string;
  committed?: string;
  balance: string;
  burnRatePercent?: string;
  lines: Array<{ budgetLine: string; budget: string; expenditure: string; committed?: string; balance: string; burnRatePercent?: string }>;
}

export interface AiReporterFinding {
  indicatorCode: string;
  indicatorId?: string;
  indicatorName?: string;
  indicatorType?: string;
  logframeLevel?: string;
  calculationMethod?: string;
  baseline?: string | number | null;
  target?: string | number | null;
  value?: string | number | null;
  valueStatus?: string;
  unit?: string | null;
  performanceEvaluation?: { type: string } | null;
  qualityFlags: string[];
  comparisonValue?: string | number | null;
  /** Progress since the project started; present for semi-annual, annual and final reports. */
  lifeOfProject?: { value: string; basis: string; periodsCovered?: number; asOf?: string; disaggregation?: Array<{ dimension: string; category: string; value: string }> } | null;
  /** Recorded breakdown (sex, age, ...) behind the value; absent when none was recorded. */
  disaggregation?: Array<{ dimension: string; category: string; value: string }>;
}

export interface AiReporterIndicatorUpdate {
  indicatorCode: string;
  indicatorId?: string;
  periodAchievement?: string;
  cumulativeAchievement?: string;
  comments?: string;
  dataSource?: string;
}

export interface AiReporterActivity {
  title: string;
  activityId?: string;
  attachedEvidenceIds?: string[];
  date?: string;
  location?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  summary?: string;
  achievements?: string;
  challenges?: string;
  lessonsLearned?: string;
  nextSteps?: string;
}

export interface AiReporterEvidenceChunk {
  chunkId: string;
  text: string;
}

export interface AiReporterEvidence {
  evidenceId: string;
  title?: string;
  evidenceType?: string;
  verificationStatus?: string;
  confidentialityLevel?: string;
  chunks: AiReporterEvidenceChunk[];
}

export interface AiReporterPriorNarrative {
  periodLabel: string;
  content: string;
  sourceSectionTitle: string;
}

/**
 * The LLM the worker must call for this request — the tenant's own
 * configuration or the platform default, resolved by the api per generation.
 * `apiKey` travels only over the internal-token-protected localhost hop and is
 * never logged or persisted by the worker. When `apiKey` is absent the worker
 * falls back to its own env (`workers.env`) for the same provider only.
 */
export interface AiReporterModelConfig {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  /** Claude only: output_config.effort. */
  effort?: string;
}

export interface AiReporterSectionRequest {
  section: AiReporterSectionBrief;
  context: AiReporterContext;
  verifiedFindings: AiReporterFinding[];
  indicatorUpdates: AiReporterIndicatorUpdate[];
  activities: AiReporterActivity[];
  retrievedEvidence: AiReporterEvidence[];
  priorNarrative: AiReporterPriorNarrative[];
  writerContractVersion: number;
  model: AiReporterModelConfig;
}

export interface AiReporterProposedSource {
  evidenceId: string;
  chunkId: string;
  sourceText: string;
}

export interface AiReporterClaim {
  text: string;
  type: "NUMERIC" | "FACTUAL" | "CAUSAL" | "QUALITATIVE";
  proposedSources: AiReporterProposedSource[];
}

export interface AiReporterSourceReference {
  type: "indicator" | "evidence" | "activity" | "template";
  id: string;
  label?: string;
}

export type AiReporterChartType = "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE";
export type AiReporterChartBinding =
  | "INDICATOR_COMPARISON"
  | "INDICATOR_ACHIEVEMENT"
  | "STATUS_DISTRIBUTION";

export interface AiReporterTablePayload {
  columns: Array<{ key: string; label: string; unit?: string }>;
  rows: Array<{ cells: Array<string | number | null>; sourceReferences: AiReporterSourceReference[] }>;
}

export interface AiReporterChartPayload {
  type: AiReporterChartType;
  dataBinding: AiReporterChartBinding;
  unit?: string;
  title: string;
  caption: string;
  categories: string[];
  series: Array<{
    name: string;
    data: Array<string | number | null>;
    sourceReferences: AiReporterSourceReference[];
  }>;
  sourceReferences: AiReporterSourceReference[];
}

export interface AiReporterListPayload {
  ordered: boolean;
  items: Array<{ text: string; sourceReferences: AiReporterSourceReference[] }>;
}

export interface AiReporterKeyValuePayload {
  entries: Array<{ key: string; value: string; sourceReferences: AiReporterSourceReference[] }>;
}

export interface AiReporterQaPayload {
  question: string;
  answer: string;
  sourceReferences: AiReporterSourceReference[];
}

export interface AiReporterDeltaPayload {
  metric: string;
  fromValue: string;
  toValue: string;
  direction: "UP" | "DOWN" | "FLAT";
  evidenceSummary: string;
  sourceReferences: AiReporterSourceReference[];
}

export type AiReporterArtifact =
  | { kind: "TABLE"; caption?: string; ordinal: number; payload: AiReporterTablePayload; sourceReferences: AiReporterSourceReference[] }
  | { kind: "CHART"; caption?: string; ordinal: number; payload: AiReporterChartPayload; sourceReferences: AiReporterSourceReference[] }
  | { kind: "LIST"; caption?: string; ordinal: number; payload: AiReporterListPayload; sourceReferences: AiReporterSourceReference[] }
  | { kind: "KEY_VALUE"; caption?: string; ordinal: number; payload: AiReporterKeyValuePayload; sourceReferences: AiReporterSourceReference[] }
  | { kind: "QA"; caption?: string; ordinal: number; payload: AiReporterQaPayload; sourceReferences: AiReporterSourceReference[] }
  | { kind: "DELTA"; caption?: string; ordinal: number; payload: AiReporterDeltaPayload; sourceReferences: AiReporterSourceReference[] };

export interface AiReporterSectionResponse {
  sectionId: string;
  title: string;
  content: string;
  claims: AiReporterClaim[];
  sourceReferences: AiReporterSourceReference[];
  /** AI Reporter 2 — typed structured artifacts (tables, charts, lists, Q&A, deltas). */
  artifacts?: AiReporterArtifact[];
  /** AI Reporter 2 — typed Q&A per mandatory question. */
  qa?: AiReporterQaPayload[];
  /** AI Reporter 2 — primary chart payload, when one was produced. */
  chartSpec?: AiReporterChartPayload;
  /** AI Reporter 2 — period-over-period delta, when prior narrative was available. */
  deltaFromPrior?: AiReporterDeltaPayload;
  telemetry?: {
    promptHash?: string;
    responseHash?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    parseOutcome?: string;
    usedFallback?: boolean;
    fallbackReason?: string;
    validatorIssues?: string[];
    /** Quality v4 — donor-voice / word-minimum warnings (never fatal). */
    qualityWarnings?: string[];
    sectionKind?: string;
    attempts?: number;
  };
}

export interface AiReporterRewriteRequest {
  sectionTitle: string;
  content: string;
  mode: "REWRITE" | "SHORTEN";
  audience: "DONOR" | "INTERNAL" | "GENERAL";
  instructions?: string;
  sourceReferences: AiReporterSourceReference[];
  writerContractVersion: number;
  model: AiReporterModelConfig;
}

export interface AiReporterRewriteResponse {
  content: string;
  promptHash?: string;
  responseHash?: string;
}

/**
 * HTTP port to the Python AI Reporter worker. The application/generator layer
 * depends on this narrow interface, never on HTTP details.
 */
export interface IWorkerClient {
  draftSection(request: AiReporterSectionRequest): Promise<Result<AiReporterSectionResponse, DomainError>>;
  rewriteSection(request: AiReporterRewriteRequest): Promise<Result<AiReporterRewriteResponse, DomainError>>;
  health(): Promise<Result<{ ok: boolean }, DomainError>>;
}
