import { Permissions } from "./permissions.js";
import type { Role } from "../contexts/identity/role.js";

/**
 * Whose records a person may see and change (Phase 63). One rule for every kind of record that belongs to the person who made it
 * (people reached today; any later one asks the same two functions): someone who holds `results.view` works across the project's records,
 * everyone else works with the ones they created. Pure: no I/O, no role names, so a new role needs a permission row, never a branch here.
 */
export interface OwnedRecord { createdById: string }

export function seesAllRecords(role: Role): boolean {
  return Permissions.can(role, "results.view");
}

export function canSeeRecord(role: Role, actorId: string, record: OwnedRecord): boolean {
  return seesAllRecords(role) || record.createdById === actorId;
}

/** Narrows a list to what the person may see; the same order, nothing added. */
export function visibleRecords<T extends OwnedRecord>(role: Role, actorId: string, records: readonly T[]): T[] {
  return seesAllRecords(role) ? [...records] : records.filter((r) => r.createdById === actorId);
}

/** Changing or removing follows seeing: a person never changes a record they cannot see. */
export const canChangeRecord = canSeeRecord;
