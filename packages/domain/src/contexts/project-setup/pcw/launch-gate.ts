/**
 * The Launch gate (Phase 38): the one place that decides whether a project may start. Every requirement must be met or marked
 * "not used", and the project must be signed off by one person, for exactly what the draft holds now (decision D7 was dropped on 2026-11-02: there is no second
 * approver at Launch). Pure; the server runs it again on Launch and never trusts the client's answer.
 */
import type { SetupDraft } from "./draft.js";
import { signOffIsCurrent } from "./launch-review.js";
import { gapInbox, type RequirementResult } from "./requirement.js";

export type LaunchBlocker = { kind: "OPEN_REQUIREMENTS"; count: number } | { kind: "SIGN_OFF_MISSING" } | { kind: "SIGN_OFF_STALE" };

export interface LaunchVerdict {
  ok: boolean;
  blockers: LaunchBlocker[];
}

export function canLaunch(results: readonly RequirementResult[], draft: SetupDraft): LaunchVerdict {
  const blockers: LaunchBlocker[] = [];
  const open = gapInbox(results).length;
  if (open > 0) blockers.push({ kind: "OPEN_REQUIREMENTS", count: open });
  if (!draft.extras.signOff.byUserId) blockers.push({ kind: "SIGN_OFF_MISSING" });
  else if (!signOffIsCurrent(draft)) blockers.push({ kind: "SIGN_OFF_STALE" });
  return { ok: blockers.length === 0, blockers };
}
