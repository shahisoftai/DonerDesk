/**
 * The wizard's draft (Phase 38): the document-derived proposal (unchanged) plus everything a person decides that no document
 * states — the team, who owns what, how each indicator is collected, the reporting rules, finance approvers, sign-off. Nothing
 * exists in the database until Launch, so people, places and plan items are referenced by draft keys (a person's `key`, an
 * indicator's code, `planKeyOf` for a planned activity), never ids. The blank path (no documents) and the document path build
 * the same type: a typed item is just a proposal item the person wrote (EDITED, no quote). Pure types and constructors.
 */
import type { ProjectSetupProposal, Proposed, PlannedActivityDef } from "../proposal.js";

export type CollectionMethod = "FORM" | "CONNECTOR" | "MANUAL" | "CALCULATED";
export type SetupReviewMode = "SIMPLE" | "FULL";
export type InviteChoice = "NOW" | "LATER";

export interface DraftPerson {
  /** Stable draft key; becomes a member id at Launch. */
  key: string;
  name: string;
  /** Needed to invite; a person can be named without one and invited later. */
  email: string | null;
  /** A `Role` of the identity context (PROJECT_MANAGER, ME_OFFICER, ...). */
  role: string;
  /** An outside partner (`User.external`): named projects only. */
  external: boolean;
  invite: InviteChoice;
}

/** What a person decides about one indicator, keyed by the indicator's code. */
export interface IndicatorSetup {
  ownerKey?: string;
  method?: CollectionMethod;
  /** Which way is better, as the person confirmed it; choosing one also confirms it. */
  direction?: "HIGHER" | "LOWER";
  directionConfirmed?: boolean;
  /** "No baseline" is an answer, not a gap. */
  baselineNone?: boolean;
}

/** What a person decides about one planned activity, keyed by `planKeyOf`. */
export interface PlanSetup {
  placeNames: string[];
  /** "Project-wide" is an answer for an activity with no single place. */
  projectWide: boolean;
  indicatorCodes: string[];
  leadKey?: string;
  requiredFiles: string[];
  recordsParticipants: boolean;
}

export interface WindowRule {
  opensDaysBefore: number;
  closesDaysAfter: number;
}

export interface CollectionSetup {
  reviewMode?: SetupReviewMode;
  windowRule?: WindowRule;
}

export interface ReportTypeRule {
  reportType: string;
  /** A template id, or "BUILT_IN" for the type's built-in structure. */
  template: string | null;
  dueDaysAfterEnd: number | null;
}

export interface ScheduleSetup {
  cadence?: string;
  rules: ReportTypeRule[];
  reminders: boolean;
}

export interface FinanceExtras {
  reportingCurrency?: string;
  /** Budget row (`budgetKeyOf`) -> planned activity (`planKeyOf`) or `SUPPORT_LINE` (overheads, staff). */
  budgetPlan: Record<string, string>;
  /** The person has seen the budget differ from the funding and accepts it. */
  differenceAcknowledged: boolean;
}

export interface SetupStart {
  donor?: string;
  sector?: string;
  country?: string;
  /** The default pack applied (fill-only); absent until one is chosen. */
  packId?: string;
  withDocuments: boolean;
}

export interface SetupSignOff {
  byUserId?: string;
  at?: string;
  /** What the draft held when it was signed (`draftFingerprint`); a later change makes the sign-off stale. */
  fingerprint?: string;
}

/** "Not used for this project": an answer. The reason is optional (decision D6). */
export interface NotUsedAnswer {
  notUsed: true;
  reason?: string;
}

export interface SetupExtras {
  start: SetupStart;
  team: DraftPerson[];
  /** Generated logframe codes the person has looked at and kept. */
  confirmedGeneratedCodes: string[];
  indicatorSetup: Record<string, IndicatorSetup>;
  planSetup: Record<string, PlanSetup>;
  projectArea?: string;
  boundaryLevel?: number;
  collection: CollectionSetup;
  schedule: ScheduleSetup;
  finance: FinanceExtras;
  dashboardTemplate?: string;
  /** Requirement key -> "not used". */
  answers: Record<string, NotUsedAnswer>;
  /** Suggestions a person rejected (`suggester:subject:target`); never offered again. */
  rejectedSuggestions: string[];
  signOff: SetupSignOff;
}

export interface SetupDraft {
  proposal: ProjectSetupProposal;
  extras: SetupExtras;
}

export const SUPPORT_LINE = "SUPPORT";

/** A planned activity's stable draft key: the key the wizard gave it, else its own work-plan code, else its title and start day. */
export function planKeyOf(def: Pick<PlannedActivityDef, "planCode" | "title" | "start"> & { key?: string | undefined }): string {
  if (def.key) return def.key;
  const code = def.planCode?.trim();
  if (code) return `code:${code}`;
  return `row:${(def.title ?? "").trim().toLowerCase()}|${def.start ?? ""}`;
}

/** A budget row's stable draft key: the budget's own reference, else its category and amount. */
export function budgetKeyOf(def: { ref?: string | null; category: string | null; amount: string | null; key?: string | undefined }): string {
  if (def.key) return def.key;
  const ref = def.ref?.trim();
  return ref ? `ref:${ref}` : `row:${(def.category ?? "").trim().toLowerCase()}|${def.amount ?? ""}`;
}

const notStated = <T>(value: T | null = null): Proposed<T> => ({
  value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED",
});

export function emptyProposal(): ProjectSetupProposal {
  return {
    facts: {
      name: notStated(), code: notStated(), donor: notStated(), countries: notStated<string[]>([]), sectors: notStated<string[]>([]),
      startDate: notStated(), endDate: notStated(), currency: notStated(), summary: notStated(),
    },
    logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [],
  };
}

export function emptyExtras(withDocuments = false): SetupExtras {
  return {
    start: { withDocuments },
    team: [],
    confirmedGeneratedCodes: [],
    indicatorSetup: {},
    planSetup: {},
    collection: {},
    schedule: { rules: [], reminders: true },
    finance: { budgetPlan: {}, differenceAcknowledged: false },
    answers: {},
    rejectedSuggestions: [],
    signOff: {},
  };
}

export function emptyDraft(withDocuments = false): SetupDraft {
  return { proposal: emptyProposal(), extras: emptyExtras(withDocuments) };
}

/** A proposal read before the wizard existed becomes a draft with no decisions yet (nothing is invented). */
export function upgradeProposal(proposal: ProjectSetupProposal): SetupDraft {
  return { proposal, extras: emptyExtras(true) };
}
