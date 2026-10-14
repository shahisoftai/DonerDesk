import type { ActivityAction, ActivityUpdate, DomainError as DomainErrorType, Result } from "@donordesk/domain";
import { DomainError, undoesAcceptance } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IActivityApprovalGuard } from "../ports/activity-approval-guard.js";

const VERB: Partial<Record<ActivityAction, string>> = { WITHDRAW: "withdrawn", REQUEST_REVISION: "reopened for correction", REJECT: "rejected" };

/**
 * One rule for every handler that can undo an accepted record: it is refused, with the report named, when an approved
 * report already used it; otherwise it is allowed (a mistake must be fixable). Without a guard (legacy wiring) it is allowed.
 */
export async function checkUndoAllowed(
  guard: IActivityApprovalGuard | undefined,
  ctx: AuthenticatedContext,
  activity: ActivityUpdate,
  action: ActivityAction,
): Promise<Result<void, DomainErrorType>> {
  if (!guard || !undoesAcceptance(activity.status, action)) return { ok: true, value: undefined };
  const used = await guard.approvedReportsUsing(ctx.tenant.tenantId, activity);
  if (!used.ok) return used;
  if (used.value.length === 0) return { ok: true, value: undefined };
  return {
    ok: false,
    error: DomainError.invalidTransition(
      `This record cannot be ${VERB[action] ?? "changed"} because ${used.value.join(" and ")} ${used.value.length === 1 ? "was" : "were"} approved using it. Reopen that report first, or add a correcting record.`,
    ),
  };
}
