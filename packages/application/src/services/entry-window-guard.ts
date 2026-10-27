import { DomainError, Permissions, entryWindowRefusal, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";

/**
 * Whether this person may enter (or hand in) values for the period right now (Phase 33.4). People who verify are never
 * held to the window — a reviewer can always enter a late figure — everyone else is refused outside it, with the dates in
 * the message. A period with no window is always open. The one place the rule is applied: every write path asks this.
 */
export function checkEntryWindow(
  ctx: AuthenticatedContext,
  period: { entryOpensOn?: string | undefined; entryClosesOn?: string | undefined },
  now: Date,
): Result<void, DomainError> {
  if (Permissions.can(ctx.tenant.role as Role, "indicator.verify")) return { ok: true, value: undefined };
  const refusal = entryWindowRefusal({ opensOn: period.entryOpensOn, closesOn: period.entryClosesOn }, now.toISOString().slice(0, 10));
  return refusal ? { ok: false, error: DomainError.conflict(refusal) } : { ok: true, value: undefined };
}
