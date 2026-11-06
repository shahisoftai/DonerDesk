/**
 * Dependencies between planned activities (finish-to-start): "B starts after A ends".
 *
 * Moving A pushes its successors by the least number of days that restores the rule, and their successors in turn.
 * Moving A earlier never pulls a successor earlier: a dependency is a minimum, not a fixed link. A successor that is
 * already DONE or CANCELLED is not moved; it is reported as blocked so the conflict is shown, never hidden.
 *
 * Pure and clock-free: the caller passes the current items and links, and receives the new dates to store.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { addDays, compareDates, daysBetween, type PlainDate } from "./plain-date.js";
import type { PlanStatus } from "./plan-status-transitions.js";

export interface PlanDependencyItem {
  id: string;
  projectId: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  status: PlanStatus;
}

/** `successorId` cannot start before `predecessorId` ends. */
export interface PlanDependencyLink {
  predecessorId: string;
  successorId: string;
}

export interface PlanDependencyMove {
  id: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  /** The item whose move pushed this one. */
  causedBy: string;
}

export interface PlanDependencyBlock {
  id: string;
  reason: "DONE" | "CANCELLED";
  causedBy: string;
}

export interface PlanCascade {
  moves: PlanDependencyMove[];
  blocked: PlanDependencyBlock[];
}

function successorsOf(links: ReadonlyArray<PlanDependencyLink>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) map.set(link.predecessorId, [...(map.get(link.predecessorId) ?? []), link.successorId]);
  return map;
}

/** True when `from` can reach `to` by following successor links. */
function reaches(links: ReadonlyArray<PlanDependencyLink>, from: string, to: string): boolean {
  const successors = successorsOf(links);
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(successors.get(id) ?? []));
  }
  return false;
}

/** Adding `predecessor → successor` closes a loop when the successor already leads back to the predecessor. */
export function wouldCreateCycle(links: ReadonlyArray<PlanDependencyLink>, predecessorId: string, successorId: string): boolean {
  return predecessorId === successorId || reaches(links, successorId, predecessorId);
}

export function canAddDependency(
  links: ReadonlyArray<PlanDependencyLink>,
  items: ReadonlyArray<PlanDependencyItem>,
  predecessorId: string,
  successorId: string,
): Result<PlanDependencyLink> {
  if (predecessorId === successorId) return err(DomainError.validation("An activity cannot come after itself"));
  const pred = items.find((i) => i.id === predecessorId);
  const succ = items.find((i) => i.id === successorId);
  if (!pred || !succ) return err(DomainError.notFound("Planned activity", !pred ? predecessorId : successorId));
  if (pred.projectId !== succ.projectId) return err(DomainError.validation("Only activities in the same project can depend on each other"));
  if (links.some((l) => l.predecessorId === predecessorId && l.successorId === successorId)) {
    return err(DomainError.validation("This link already exists"));
  }
  if (wouldCreateCycle(links, predecessorId, successorId)) {
    return err(DomainError.validation("This would make the activities wait for each other in a loop"));
  }
  return ok({ predecessorId, successorId });
}

/**
 * Items pushed or blocked by a move of `movedId`. `items` must already hold the moved item's new dates.
 * Each successor is checked against the latest date of every predecessor, so a diamond (two routes to one
 * successor) keeps the later constraint. Terminates because links are acyclic (`canAddDependency`).
 */
export function cascadeAfterMove(
  items: ReadonlyArray<PlanDependencyItem>,
  links: ReadonlyArray<PlanDependencyLink>,
  movedId: string,
): PlanCascade {
  const byId = new Map(items.map((i) => [i.id, { ...i }]));
  const successors = successorsOf(links);
  const moves = new Map<string, PlanDependencyMove>();
  const blocked = new Map<string, PlanDependencyBlock>();
  const queue = [movedId];

  while (queue.length) {
    const predId = queue.shift()!;
    const pred = byId.get(predId);
    if (!pred) continue;
    for (const succId of successors.get(predId) ?? []) {
      const succ = byId.get(succId);
      if (!succ) continue;
      const earliest = addDays(pred.plannedEnd, 1);
      if (compareDates(succ.plannedStart, earliest) >= 0) continue;
      if (succ.status === "DONE" || succ.status === "CANCELLED") {
        blocked.set(succId, { id: succId, reason: succ.status, causedBy: predId });
        continue;
      }
      const shift = daysBetween(succ.plannedStart, earliest);
      succ.plannedStart = addDays(succ.plannedStart, shift);
      succ.plannedEnd = addDays(succ.plannedEnd, shift);
      moves.set(succId, { id: succId, plannedStart: succ.plannedStart, plannedEnd: succ.plannedEnd, causedBy: predId });
      queue.push(succId);
    }
  }
  return { moves: [...moves.values()], blocked: [...blocked.values()] };
}
