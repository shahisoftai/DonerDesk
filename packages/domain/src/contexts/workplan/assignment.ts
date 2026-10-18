/**
 * Who may lead or help with a planned activity: an active member of the project, at most `MAX_SUPPORT_USERS`
 * helpers, and nobody listed twice. One rule for the plan form, the wizard and the import.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export const MAX_SUPPORT_USERS = 10;

export interface PlanPeople {
  ownerUserId?: string;
  supportUserIds: string[];
}

export function checkAssignable(people: { ownerUserId?: string; supportUserIds?: ReadonlyArray<string> }, activeMemberIds: ReadonlySet<string>): Result<PlanPeople> {
  const support = [...new Set(people.supportUserIds ?? [])].filter((id) => id !== people.ownerUserId);
  if (support.length > MAX_SUPPORT_USERS) return err(DomainError.validation(`At most ${MAX_SUPPORT_USERS} people can help with one activity`));
  for (const id of [people.ownerUserId, ...support]) {
    if (id !== undefined && !activeMemberIds.has(id)) {
      return err(DomainError.validation("Only an active member of the project can lead or help with an activity", { userId: id }));
    }
  }
  return ok({ ...(people.ownerUserId !== undefined ? { ownerUserId: people.ownerUserId } : {}), supportUserIds: support });
}
