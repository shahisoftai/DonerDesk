/**
 * What the project itself will be created with (Phase 36.3): the facts the review accepted, as a draft the person
 * completes. Fields the document cannot give (the implementing organisation, the sector from the fixed list, the
 * reporting frequency) are named in `missing`; nothing is filled with a default the person did not choose. Pure.
 */
import { willApplyItem } from "./project-codes.js";
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export interface ProjectDraft {
  title?: string;
  projectCode?: string;
  donorName?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  budgetCurrency?: string;
  description?: string;
  /** Suggested from the accepted reporting periods (the first cadence named); the person still confirms it. */
  reportingFrequency?: string;
}

/** Fields the create-project form requires; the ones a draft cannot fill are listed for the person. */
export const PROJECT_REQUIRED_FIELDS = [
  "title", "projectCode", "donorName", "implementingOrganization", "country", "sector", "startDate", "endDate", "reportingFrequency",
] as const;

const accepted = <T>(item: Proposed<T>): T | undefined => (willApplyItem(item) ? (item.value as T) : undefined);

const CADENCE_TO_FREQUENCY: Readonly<Record<string, string>> = { MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY", SEMI_ANNUAL: "SEMI_ANNUAL", ANNUAL: "ANNUAL" };

export function projectDraftFromProposal(proposal: ProjectSetupProposal): { draft: ProjectDraft; missing: string[] } {
  const f = proposal.facts;
  const countries = accepted(f.countries);
  const cadence = proposal.periods.map(accepted).find((p) => p?.type && CADENCE_TO_FREQUENCY[p.type])?.type;
  const draft: ProjectDraft = {};
  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K] | undefined | null) => {
    if (value) draft[key] = value;
  };
  set("title", accepted(f.name));
  set("projectCode", accepted(f.code));
  set("donorName", accepted(f.donor));
  set("country", countries?.[0]);
  set("startDate", accepted(f.startDate));
  set("endDate", accepted(f.endDate));
  set("budgetCurrency", accepted(f.currency));
  set("description", accepted(f.summary)?.slice(0, 2000));
  set("reportingFrequency", cadence ? CADENCE_TO_FREQUENCY[cadence] : undefined);
  const missing = PROJECT_REQUIRED_FIELDS.filter((k) => !(k in draft));
  return { draft, missing };
}
