import type { SnapshotIndicator } from "./logframe-snapshot.js";

/**
 * What may change about an indicator once the framework has been approved (pure). Handlers load the facts and apply
 * the answer; the rules live here, in one ordered table, so a new rule is a row.
 */
export const MIN_REVISION_REASON = 10;

/** The definition fields an approved report was judged against. */
export const JUDGED_FIELDS = ["baseline", "target", "targetSchedule", "targetBreakdowns"] as const;
export type JudgedField = (typeof JUDGED_FIELDS)[number];

export interface PostApprovalFacts {
  /** The indicator as the latest approved version records it; null when there is no approved version or it is not in it. */
  approved: SnapshotIndicator | null;
  /** The fields this edit would write. */
  patch: Record<string, unknown>;
  /** Why, in the person's words. */
  reason: string | undefined;
  /** An approved (or exported, or submitted) report used this indicator's values. */
  usedInApprovedReport: boolean;
}

export type PostApprovalVerdict =
  | { allowed: true; reason?: string }
  | { allowed: false; code: "REASON_REQUIRED" | "CODE_LOCKED"; message: string };

interface Rule {
  id: string;
  /** A verdict, or undefined to let the next rule decide. */
  decide(facts: PostApprovalFacts): PostApprovalVerdict | undefined;
}

const same = (a: unknown, b: unknown) => JSON.stringify(emptyToNone(a)) === JSON.stringify(emptyToNone(b));
const emptyToNone = (v: unknown) => (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === "" ? null : v);

export function judgedFieldsChanged(facts: Pick<PostApprovalFacts, "approved" | "patch">): JudgedField[] {
  const approved = facts.approved as unknown as Record<string, unknown> | null;
  if (!approved) return [];
  return JUDGED_FIELDS.filter((f) => f in facts.patch && !same(facts.patch[f], approved[f]));
}

/** Ordered: the first rule with an opinion decides. */
export const POST_APPROVAL_RULES: ReadonlyArray<Rule> = [
  {
    id: "NOT_IN_APPROVED_FRAMEWORK",
    decide: (f) => (f.approved ? undefined : { allowed: true }),
  },
  {
    id: "CODE_IS_FIXED",
    decide: (f) =>
      "code" in f.patch && f.patch.code !== f.approved?.code
        ? { allowed: false, code: "CODE_LOCKED", message: "The code of an indicator in an approved framework does not change. Archive it and add a new indicator instead." }
        : undefined,
  },
  {
    id: "JUDGED_FIELD_NEEDS_REASON",
    decide: (f) => {
      const changed = judgedFieldsChanged(f);
      if (changed.length === 0 || !f.usedInApprovedReport) return undefined;
      const reason = (f.reason ?? "").trim();
      return reason.length >= MIN_REVISION_REASON
        ? { allowed: true, reason }
        : { allowed: false, code: "REASON_REQUIRED", message: `A report that has been approved used this indicator. To change its ${changed.join(", ")}, say why (at least ${MIN_REVISION_REASON} characters); the reason is kept with the framework's history.` };
    },
  },
];

export function checkPostApprovalChange(facts: PostApprovalFacts): PostApprovalVerdict {
  for (const rule of POST_APPROVAL_RULES) {
    const verdict = rule.decide(facts);
    if (verdict) return verdict;
  }
  return { allowed: true };
}
