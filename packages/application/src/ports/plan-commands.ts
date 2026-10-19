import type { DomainError, Result } from "@donordesk/domain";
import type { AssignPlannedActivityInput, ChangePlanStatusInput, ReschedulePlannedActivityInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../context.js";

/**
 * The three single-activity commands other use cases build on (bulk change, one-step Done). They are interfaces so a caller
 * depends on what it needs, not on a concrete handler class; the handlers satisfy them structurally.
 */
export interface IAssignPlan {
  handle(ctx: AuthenticatedContext, itemId: string, input: AssignPlannedActivityInput): Promise<Result<unknown, DomainError>>;
}
export interface IReschedulePlan {
  handle(ctx: AuthenticatedContext, itemId: string, input: ReschedulePlannedActivityInput): Promise<Result<unknown, DomainError>>;
}
export interface IChangePlanStatus {
  handle(ctx: AuthenticatedContext, itemId: string, input: ChangePlanStatusInput): Promise<Result<unknown, DomainError>>;
}
