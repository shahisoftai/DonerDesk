/**
 * Edits to the planned activities (Phase 38.5): the pure operations the Work plan slide makes on the proposal. A row a person
 * adds or changes is theirs (EDITED, no quote). Links to places, indicators and a lead are decisions, not proposal fields (see
 * `SET_PLAN_SETUP`), so they are keyed by the row's stable `key`: the first edit of a row gives it the key it already had, so
 * nothing chosen for it is orphaned by a new title or date. Dates are plain days and the end is never before the start.
 */
import { isPlainDate } from "../../workplan/plain-date.js";
import type { PlannedActivityDef, ProjectSetupProposal, Proposed } from "../proposal.js";
import { planKeyOf } from "./draft.js";

export type PlanOperation =
  | { kind: "ADD_PLAN"; title: string; logframeCode?: string | null; start?: string | null; end?: string | null; location?: string | null }
  | { kind: "EDIT_PLAN"; path: string; patch: Partial<Pick<PlannedActivityDef, "title" | "logframeCode" | "start" | "end" | "location">> };

export type PlanOperationResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };
type Handler<K extends PlanOperation["kind"]> = (p: ProjectSetupProposal, op: Extract<PlanOperation, { kind: K }>) => PlanOperationResult;

const refuse = (reason: string): PlanOperationResult => ({ ok: false, reason });
const clean = (v: string | null | undefined, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const day = (v: string | null | undefined): { ok: true; value: string | null } | { ok: false } => {
  const t = clean(v, 10);
  return t === null ? { ok: true, value: null } : isPlainDate(t) ? { ok: true, value: t } : { ok: false };
};
const activityCodes = (p: ProjectSetupProposal): Set<string> =>
  new Set(p.logframe.filter((n) => n.status !== "REJECTED" && n.value?.level === "ACTIVITY" && n.value.code).map((n) => n.value!.code as string));

/** A new row's key is unique among the keys already in use. */
function freshKey(p: ProjectSetupProposal): string {
  const used = new Set(p.plan.filter((x) => x.value !== null).map((x) => planKeyOf(x.value!)));
  for (let n = p.plan.length + 1; ; n += 1) if (!used.has(`new:${n}`)) return `new:${n}`;
}

function datesProblem(start: string | null, end: string | null): string | null {
  return start !== null && end !== null && end < start ? "The end date cannot be before the start date." : null;
}

export const PLAN_OPERATIONS: { [K in PlanOperation["kind"]]: Handler<K> } = {
  ADD_PLAN: (p, { title, logframeCode, start, end, location }) => {
    const name = clean(title, 300);
    if (!name) return refuse("Give the activity a name.");
    const code = clean(logframeCode, 40);
    if (code && !activityCodes(p).has(code)) return refuse("Choose one of the project's activities from the results framework.");
    const s = day(start), e = day(end);
    if (!s.ok || !e.ok) return refuse("Dates are written as year-month-day, for example 2026-03-01.");
    const problem = datesProblem(s.value, e.value);
    if (problem) return refuse(problem);
    const value: PlannedActivityDef = { title: name, logframeCode: code, start: s.value, end: e.value, location: clean(location, 200), lead: null, key: freshKey(p), ...(code ? { linkSource: "PERSON" as const } : {}) };
    const item: Proposed<PlannedActivityDef> = { value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" };
    return { ok: true, proposal: { ...p, plan: [...p.plan, item] } };
  },
  EDIT_PLAN: (p, { path, patch }) => {
    const [head, raw] = path.split(".");
    const index = Number(raw);
    const item = head === "plan" && Number.isInteger(index) ? p.plan[index] : undefined;
    if (!item || item.status === "REJECTED" || item.value === null) return refuse("That activity is not in the plan.");
    // Keep the address the row had, whatever is changed now.
    const next: PlannedActivityDef = { ...item.value, key: planKeyOf(item.value) };
    if (patch.title !== undefined) { const t = clean(patch.title, 300); if (!t) return refuse("An activity needs a name."); next.title = t; }
    if (patch.location !== undefined) next.location = clean(patch.location, 200);
    if (patch.logframeCode !== undefined) {
      const code = clean(patch.logframeCode, 40);
      if (code && !activityCodes(p).has(code)) return refuse("Choose one of the project's activities from the results framework.");
      next.logframeCode = code;
      next.linkSource = "PERSON";
    }
    for (const field of ["start", "end"] as const) {
      if (patch[field] === undefined) continue;
      const d = day(patch[field]);
      if (!d.ok) return refuse("Dates are written as year-month-day, for example 2026-03-01.");
      next[field] = d.value;
    }
    const problem = datesProblem(next.start, next.end);
    if (problem) return refuse(problem);
    return { ok: true, proposal: { ...p, plan: p.plan.map((x, i) => (i === index ? { ...x, value: next, status: "EDITED" as const } : x)) } };
  },
};

export function applyPlanOperation(proposal: ProjectSetupProposal, op: PlanOperation): PlanOperationResult {
  const handler = PLAN_OPERATIONS[op.kind] as (p: ProjectSetupProposal, o: PlanOperation) => PlanOperationResult;
  return handler(proposal, op);
}
