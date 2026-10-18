/**
 * An append-only change to a planned activity (dates, lead, target, cancel). The reasons are the project's decision
 * history: shown on the activity and as "Recent changes to the plan". Never edited or deleted.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export type PlanFieldChange = { from: unknown; to: unknown };
export type PlanChangeSet = Readonly<Record<string, PlanFieldChange>>;

/** What an aggregate change produced; the handler stores it as a `PlanRevision`. */
export interface PlanChange {
  change: PlanChangeSet;
  reason?: string;
}

export interface PlanRevision {
  id: string;
  tenantId: string;
  projectId: string;
  plannedActivityId: string;
  change: PlanChangeSet;
  reason?: string;
  changedById: string;
  changedAt: Date;
}

export function createPlanRevision(input: Omit<PlanRevision, "change" | "reason"> & PlanChange): Result<PlanRevision> {
  if (Object.keys(input.change).length === 0) return err(DomainError.validation("A plan change must change something"));
  const { reason: raw, change, ...rest } = input;
  const reason = raw?.trim();
  return ok({ ...rest, change: { ...change }, ...(reason ? { reason } : {}) });
}

/** Only the fields whose value differs (dates compared as text). */
export function diffFields<T extends object>(before: T, after: Partial<T>): Record<string, PlanFieldChange> {
  const out: Record<string, PlanFieldChange> = {};
  for (const key of Object.keys(after)) {
    const from = (before as Record<string, unknown>)[key];
    const to = (after as Record<string, unknown>)[key];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) out[key] = { from: from ?? null, to: to ?? null };
  }
  return out;
}
