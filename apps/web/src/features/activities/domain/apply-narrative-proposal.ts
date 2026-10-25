import type { ActivityDraft } from "./activity-draft.ts";

/** The subset of the proposal the form can take (the domain type has numbers and optional keys). */
export interface NarrativeProposal {
  activityTitle?: string;
  activityDate?: string;
  activityEndDate?: string;
  location?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  summary?: string;
  achievements?: string;
  challenges?: string;
  lessonsLearned?: string;
  nextSteps?: string;
}

export const PROPOSAL_LABELS: Readonly<Record<keyof NarrativeProposal, string>> = {
  activityTitle: "title",
  activityDate: "date",
  activityEndDate: "end date",
  location: "place",
  participantsTotal: "total participants",
  participantsMale: "men",
  participantsFemale: "women",
  participantsChildren: "children",
  participantsDisability: "people with disability",
  summary: "summary",
  achievements: "achievements",
  challenges: "challenges",
  lessonsLearned: "lessons learned",
  nextSteps: "next steps",
};

/**
 * Fills only the fields that are still empty, so nothing the person already typed is overwritten, and reports what
 * it filled and what it left because the form already had a value.
 */
export function applyNarrativeProposal(
  current: Pick<ActivityDraft, keyof NarrativeProposal>,
  proposal: NarrativeProposal,
): { next: Pick<ActivityDraft, keyof NarrativeProposal>; filled: Array<keyof NarrativeProposal>; kept: Array<keyof NarrativeProposal> } {
  const next = { ...current };
  const filled: Array<keyof NarrativeProposal> = [];
  const kept: Array<keyof NarrativeProposal> = [];
  for (const key of Object.keys(PROPOSAL_LABELS) as Array<keyof NarrativeProposal>) {
    const proposed = proposal[key];
    if (proposed === undefined) continue;
    if (current[key].trim() !== "") {
      kept.push(key);
      continue;
    }
    next[key] = String(proposed);
    filled.push(key);
  }
  return { next, filled, kept };
}
