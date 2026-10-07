import type { ChecklistItemType } from "./checklist-item.js";

/**
 * Two kinds of checklist item. A STATE item describes something that is either true or false of the report's
 * data right now (activities exist, finance is verified, a breakdown is recorded): it closes by itself when the
 * data satisfies it. An ATTESTATION needs a person (sign-off, sensitive-data handling, AI output reviewed):
 * nothing closes it but a person, and a scan never raises it again once someone has decided it.
 *
 * `Record<ChecklistItemType, ...>` makes the compiler refuse a new item type nobody classified.
 */
export type ChecklistKind = "STATE" | "ATTESTATION";

export const CHECKLIST_KIND: Readonly<Record<ChecklistItemType, ChecklistKind>> = {
  MISSING_EVIDENCE: "STATE",
  INCOMPLETE_EVIDENCE_METADATA: "ATTESTATION",
  UNVERIFIED_INDICATOR: "STATE",
  UNSUPPORTED_REPORT_CLAIM: "ATTESTATION",
  MISSING_ANNEX: "ATTESTATION",
  MISSING_PROCUREMENT_DOCUMENT: "ATTESTATION",
  MISSING_APPROVAL: "ATTESTATION",
  MISSING_DISAGGREGATION: "STATE",
  LATE_ACTIVITY_UPDATE: "STATE",
  SENSITIVE_DATA_WARNING: "ATTESTATION",
  // "AI content reviewed" is something a person states; approving sections does not stand in for it.
  UNREVIEWED_AI_OUTPUT: "ATTESTATION",
  DONOR_REQUIREMENT: "ATTESTATION",
  AFFECTED_FIGURES_CONFIRMED: "ATTESTATION",
  ACTIVITY_RECORD_ACCEPTED: "STATE",
  CUMULATIVE_DATA_COMPLETE: "STATE",
  PRIOR_REPORT_LINKED: "STATE",
  FINANCE_FIGURES_PROVIDED: "STATE",
  INDICATOR_SEMANTICS_UNREVIEWED: "STATE",
};

export function isAttestation(type: ChecklistItemType): boolean {
  return CHECKLIST_KIND[type] === "ATTESTATION";
}

/** What the data says right now. A field left out means "not known in this scan": its rules then say nothing. */
export interface ChecklistFacts {
  evidenceCount?: number;
  requiredEvidenceCount?: number;
  activityCount?: number;
  verifiedIndicatorCount?: number;
  totalIndicatorCount?: number;
  /** In-scope indicators that require a breakdown and have none recorded this period. */
  missingBreakdownCount?: number;
  /** Status of each activity record of the report, by id. */
  activityStatusById?: ReadonlyMap<string, string>;
  /** Indicators whose calculation is confirmed. */
  confirmedSemanticsIds?: ReadonlySet<string>;
  /** Verified evidence files of type procurement document on the project; undefined when not counted. */
  verifiedProcurementDocumentCount?: number;
  financeStatus?: "OFF" | "MISSING" | "UNVERIFIED" | "VERIFIED";
  /** Indicators still missing cumulative fields (roll-up reports); undefined when not evaluated. */
  cumulativeGapIds?: ReadonlySet<string>;
  /** Whether the comparable earlier report is finished or absent; undefined when not evaluated. */
  priorReportLinked?: boolean;
}

export interface ChecklistStateRule {
  type: ChecklistItemType;
  /** true: the data satisfies it, false: it does not, undefined: cannot tell from what is known. */
  isSatisfied(facts: ChecklistFacts, relatedEntityId: string | undefined): boolean | undefined;
  /** Why it closed, in words a user can read. */
  reason: string;
}

/**
 * Attestations that data can also settle: a person states them, but when the record they ask for exists and is
 * verified there is nothing left to attest ("final procurement records available" once a verified procurement
 * document is on file). Still attestations for everything else (`isAttestation`, never re-raised once decided).
 */
export const DATA_SETTLED_ATTESTATIONS: ReadonlySet<ChecklistItemType> = new Set<ChecklistItemType>(["MISSING_PROCUREMENT_DOCUMENT"]);

export const CHECKLIST_STATE_RULES: ReadonlyArray<ChecklistStateRule> = [
  {
    type: "MISSING_PROCUREMENT_DOCUMENT",
    isSatisfied: (f) => (f.verifiedProcurementDocumentCount === undefined ? undefined : f.verifiedProcurementDocumentCount > 0),
    reason: "a verified procurement document is on file",
  },
  {
    type: "MISSING_EVIDENCE",
    isSatisfied: (f) => (f.evidenceCount === undefined || f.requiredEvidenceCount === undefined ? undefined : f.evidenceCount >= f.requiredEvidenceCount),
    reason: "the evidence now on file covers what was required",
  },
  {
    type: "UNVERIFIED_INDICATOR",
    isSatisfied: (f) => (f.verifiedIndicatorCount === undefined || f.totalIndicatorCount === undefined ? undefined : f.verifiedIndicatorCount >= f.totalIndicatorCount),
    reason: "every indicator value is verified",
  },
  {
    type: "LATE_ACTIVITY_UPDATE",
    isSatisfied: (f) => (f.activityCount === undefined ? undefined : f.activityCount > 0),
    reason: "activity updates have been submitted",
  },
  {
    type: "MISSING_DISAGGREGATION",
    isSatisfied: (f) => (f.missingBreakdownCount === undefined ? undefined : f.missingBreakdownCount === 0),
    reason: "every indicator that needs a breakdown has one",
  },
  {
    type: "ACTIVITY_RECORD_ACCEPTED",
    isSatisfied: (f, entityId) => {
      const status = entityId ? f.activityStatusById?.get(entityId) : undefined;
      return status === undefined ? undefined : status === "ACCEPTED" || status === "WITHDRAWN";
    },
    reason: "the activity record is accepted or withdrawn",
  },
  {
    type: "INDICATOR_SEMANTICS_UNREVIEWED",
    isSatisfied: (f, entityId) => (f.confirmedSemanticsIds === undefined || !entityId ? undefined : f.confirmedSemanticsIds.has(entityId)),
    reason: "the indicator's calculation is confirmed",
  },
  {
    type: "FINANCE_FIGURES_PROVIDED",
    isSatisfied: (f) => (f.financeStatus === undefined ? undefined : f.financeStatus === "OFF" || f.financeStatus === "VERIFIED"),
    reason: "the financial figures are verified",
  },
  {
    type: "CUMULATIVE_DATA_COMPLETE",
    isSatisfied: (f, entityId) => (f.cumulativeGapIds === undefined || !entityId ? undefined : !f.cumulativeGapIds.has(entityId)),
    reason: "the indicator now has its baseline, target and verified cumulative value",
  },
  {
    type: "PRIOR_REPORT_LINKED",
    isSatisfied: (f) => f.priorReportLinked,
    reason: "the earlier report is finished",
  },
];

/** Whether a concern is already settled by the data (so it must not be raised at all). Attestations and unknowns are never settled. */
export function isSatisfiedByFacts(type: ChecklistItemType, facts: ChecklistFacts, relatedEntityId: string | undefined): boolean {
  if (CHECKLIST_KIND[type] !== "STATE" && !DATA_SETTLED_ATTESTATIONS.has(type)) return false;
  return CHECKLIST_STATE_RULES.find((r) => r.type === type)?.isSatisfied(facts, relatedEntityId) === true;
}

/** Open STATE items the data now satisfies, with the reason to record. Attestations are never returned. */
export function stateItemsToClose<T extends { type: ChecklistItemType; status: string; relatedEntityId?: string | undefined }>(
  items: ReadonlyArray<T>,
  facts: ChecklistFacts,
): Array<{ item: T; reason: string }> {
  const out: Array<{ item: T; reason: string }> = [];
  for (const item of items) {
    if (item.status !== "OPEN" && item.status !== "IN_PROGRESS") continue;
    if (CHECKLIST_KIND[item.type] !== "STATE" && !DATA_SETTLED_ATTESTATIONS.has(item.type)) continue;
    const rule = CHECKLIST_STATE_RULES.find((r) => r.type === item.type);
    if (!rule) continue;
    if (rule.isSatisfied(facts, item.relatedEntityId) === true) out.push({ item, reason: `Closed automatically: ${rule.reason}.` });
  }
  return out;
}

const DECIDED = new Set(["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"]);

/**
 * Whether a scan should leave a concern alone because it is already tracked. Active items always count. A decided
 * attestation counts too (same type, entity and title): once a person has decided it, only a new cause, a
 * different title, raises it again. A decided STATE item does not: the data can become wrong again.
 */
export function isConcernTracked(
  existing: ReadonlyArray<{ type: ChecklistItemType; status: string; relatedEntityId?: string | undefined; title?: string | undefined }>,
  suggestion: { type: ChecklistItemType; relatedEntityId?: string | undefined; title: string },
): boolean {
  return existing.some((e) => {
    if (e.type !== suggestion.type || (e.relatedEntityId ?? "") !== (suggestion.relatedEntityId ?? "")) return false;
    if (e.status === "OPEN" || e.status === "IN_PROGRESS") return true;
    return DECIDED.has(e.status) && CHECKLIST_KIND[e.type] === "ATTESTATION" && e.title === suggestion.title;
  });
}
