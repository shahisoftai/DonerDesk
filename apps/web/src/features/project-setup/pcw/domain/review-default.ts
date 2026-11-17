import type { SetupReviewMode } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

/** A team smaller than this checks its own values in one step: simple review is the starting answer (Phase 59). */
export const SMALL_TEAM_BELOW = 3;

export const isSmallTeam = (teamSize: number): boolean => teamSize > 0 && teamSize < SMALL_TEAM_BELOW;

/** The review mode to set for the person, or null: only when none was chosen yet and the team is small. A choice is never replaced. */
export function reviewDefaultFor(view: SetupDraftView): SetupReviewMode | null {
  if (view.extras.collection.reviewMode !== undefined) return null;
  return isSmallTeam(view.extras.team.length) ? "SIMPLE" : null;
}
