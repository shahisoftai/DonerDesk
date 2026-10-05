import type { Result, DomainError, EvidenceFile, IndicatorUpdate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";

export type IndicatorLinkOutcome = "ATTACHED" | "PENDING" | "NONE";

/**
 * The single place that links an evidence file to the things it proves: the activity it documents
 * and the indicator update (one indicator's value for one period) it supports. Upload, import,
 * Drive link, attach and detach all go through it, so "tagged" and "attached" can never diverge.
 */
export interface IEvidenceLinker {
  attachToActivity(ctx: AuthenticatedContext, evidenceId: string, activityId: string): Promise<Result<void, DomainError>>;
  detachFromActivity(ctx: AuthenticatedContext, evidenceId: string, activityId: string): Promise<Result<void, DomainError>>;
  /** `target` is an indicator-update id, or (convenience) an indicator id resolved through the file's reporting period. */
  attachToIndicator(ctx: AuthenticatedContext, evidenceId: string, target: string): Promise<Result<void, DomainError>>;
  detachFromIndicator(ctx: AuthenticatedContext, evidenceId: string, target: string): Promise<Result<void, DomainError>>;
  /** Called right after an upload: an activity is attached at once; an indicator is attached when its update exists, else left as a tag until it does. */
  linkOnUpload(ctx: AuthenticatedContext, evidence: EvidenceFile): Promise<Result<{ indicator: IndicatorLinkOutcome; activity: boolean }, DomainError>>;
  /** Called when an indicator update is first created: attaches the files already tagged to that indicator for its period. */
  attachPendingFor(ctx: AuthenticatedContext, update: IndicatorUpdate): Promise<Result<number, DomainError>>;
}
