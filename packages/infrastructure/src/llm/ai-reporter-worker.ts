import type { DomainError, Result } from "@donordesk/domain";

/**
 * TypeScript mirror of the Python AI Reporter's wire contract. The worker is a
 * stateless prose engine: it receives a section brief plus pre-retrieved
 * evidence and returns a GeneratedSection-shaped response. The deterministic
 * assurance pipeline remains the final authority.
 */

export interface AiReporterSectionBrief {
  title: string;
  inputType?: string;
  minWords?: number;
  maxWords?: number;
  mandatoryQuestions: string[];
  evidenceNeeds: string[];
  relatedLogframeElement?: string;
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
  startDate?: string;
  endDate?: string;
  deadline?: string;
  readinessScore?: number;
}

export interface AiReporterContextTemplate {
  templateName?: string;
  donorName?: string;
  language?: string;
  requiredAnnexes: string[];
  notes?: string;
  version?: number;
}

export interface AiReporterContext {
  project?: AiReporterContextProject;
  period?: AiReporterContextPeriod;
  template?: AiReporterContextTemplate;
  profile?: { tone: string; language: string; formattingRules: string[] };
}

export interface AiReporterFinding {
  indicatorCode: string;
  indicatorName?: string;
  baseline?: string | number | null;
  target?: string | number | null;
  value?: string | number | null;
  valueStatus?: string;
  unit?: string | null;
  performanceEvaluation?: { type: string } | null;
  qualityFlags: string[];
  comparisonValue?: string | number | null;
}

export interface AiReporterIndicatorUpdate {
  indicatorCode: string;
  periodAchievement?: string;
  cumulativeAchievement?: string;
  comments?: string;
  dataSource?: string;
}

export interface AiReporterActivity {
  title: string;
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

export interface AiReporterSectionRequest {
  section: AiReporterSectionBrief;
  context: AiReporterContext;
  verifiedFindings: AiReporterFinding[];
  indicatorUpdates: AiReporterIndicatorUpdate[];
  activities: AiReporterActivity[];
  retrievedEvidence: AiReporterEvidence[];
  priorNarrative: AiReporterPriorNarrative[];
  writerContractVersion: number;
  model: { provider: string; model?: string };
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

export interface AiReporterSectionResponse {
  sectionId: string;
  title: string;
  content: string;
  claims: AiReporterClaim[];
  sourceReferences: AiReporterSourceReference[];
  telemetry?: {
    promptHash?: string;
    responseHash?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    parseOutcome?: string;
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
  model: { provider: string; model?: string };
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
