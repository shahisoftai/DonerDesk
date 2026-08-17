import type { VerifiedFinding } from "./verified-finding.js";

/**
 * ReportGenerationRun is the immutable audit boundary of a generation run.
 * The snapshot captures every input consumed at run start (indicator update
 * IDs, evidence IDs, findings, model and prompt versions) so the run is
 * reproducible and later mutations cannot silently alter what was generated.
 * A snapshot is persisted once and never mutated; rewrites create child runs.
 */
export interface GenerationRunSnapshot {
  id: string;
  tenantId: string;
  projectId: string;
  reportingPeriodId: string;
  draftId: string;
  templateVersion: number;
  profileVersion: number;
  mappingVersion?: number;
  plannerVersion: number;
  indicatorUpdateIds: string[];
  activityIds: string[];
  evidenceIds: string[];
  verifiedFindings: VerifiedFinding[];
  modelId: string;
  promptVersion: number;
  generationParams: Record<string, string>;
  createdAt: Date;
}

export class ReportGenerationRun {
  private constructor(readonly snapshot: GenerationRunSnapshot, readonly createdAt: Date) {}

  get id(): string {
    return this.snapshot.id;
  }

  static create(snapshot: Omit<GenerationRunSnapshot, "createdAt">): ReportGenerationRun {
    if (!snapshot.id || !snapshot.tenantId || !snapshot.reportingPeriodId || !snapshot.draftId) {
      throw new Error("A generation run requires id, tenantId, reportingPeriodId, and draftId");
    }
    return new ReportGenerationRun({ ...snapshot, createdAt: new Date() }, new Date());
  }

  static rehydrate(snapshot: GenerationRunSnapshot): ReportGenerationRun {
    return new ReportGenerationRun(snapshot, snapshot.createdAt);
  }
}
