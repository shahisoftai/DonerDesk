/**
 * The one exhaustive table of setup areas (open/closed): a new area is one row here plus its extractor, applier and review
 * cell renderer — nothing that sequences, plans, reviews or applies is edited. Each row owns everything area-specific: the
 * proposal fields it covers, what must be read before it, where it sits in the apply order, and how its items are counted.
 * No code outside this table branches on an area name.
 */
import type { ProjectSetupProposal, Proposed } from "./proposal.js";
import { isBudgetNotAppliedNote } from "./apply-sheets.js";

export type SetupAreaKey =
  | "FACTS" | "LOGFRAME" | "INDICATORS" | "PERIODS" | "PLAN" | "PLACES" | "FUNDING_BUDGET" | "RISKS";

export interface SetupAreaDef {
  key: SetupAreaKey;
  /** i18n key; the web catalogue translates it (`setup.area.<key>`). */
  labelKey: string;
  /** The proposal fields the area owns; an item path must start with one of them. */
  fields: readonly string[];
  /** Areas that must be read (and applied) first. */
  dependsOn: readonly SetupAreaKey[];
  /** Fixed place in the apply order; 1 is applied first. */
  applyOrder: number;
  /** Always exists in some form: its headings say where to look, never that it is empty. */
  alwaysPresent?: boolean;
  /** Everything proposed for the area, whatever the person has decided so far. */
  items: (p: ProjectSetupProposal) => number;
  /** Items that will be applied: accepted, or written by the person (EDITED is a decision). */
  accepted: (p: ProjectSetupProposal) => number;
  /** What else changes when one of the area's items is rejected (`before` is the proposal before, `after` with the item rejected). */
  afterReject?: (before: ProjectSetupProposal, after: ProjectSetupProposal, path: string) => ProjectSetupProposal;
  /** Notes of the plain apply that the wizard's launch must not show for this area (the wizard does that part itself). */
  launchNoteHidden?: (note: string) => boolean;
}

const willApply = (item: Proposed<unknown>): boolean => item.status === "ACCEPTED" || item.status === "EDITED";
const countAccepted = (items: ReadonlyArray<Proposed<unknown>>): number => items.filter(willApply).length;

/** What sat under a removed result is not left pointing at it (a dangling parent would look chosen but break the chain). */
function unlinkChildrenOfRejectedResult(before: ProjectSetupProposal, after: ProjectSetupProposal, path: string): ProjectSetupProposal {
  const index = Number(path.split(".")[1]);
  const code = (before.logframe[index]?.value as { code?: string | null } | null | undefined)?.code ?? null;
  if (!code) return after;
  const unlink = <T extends { parentCode?: string | null }>(item: Proposed<T>): Proposed<T> =>
    item.value && item.value.parentCode === code ? { ...item, value: { ...item.value, parentCode: null } } : item;
  return { ...after, logframe: after.logframe.map(unlink) };
}

export const SETUP_AREAS: Record<SetupAreaKey, SetupAreaDef> = {
  FACTS: {
    key: "FACTS", labelKey: "setup.area.facts", fields: ["facts"], dependsOn: [], applyOrder: 1, alwaysPresent: true,
    items: (p) => Object.keys(p.facts).length, accepted: (p) => countAccepted(Object.values(p.facts)),
  },
  LOGFRAME: {
    key: "LOGFRAME", labelKey: "setup.area.logframe", fields: ["logframe"], dependsOn: ["FACTS"], applyOrder: 2,
    items: (p) => p.logframe.length, accepted: (p) => countAccepted(p.logframe),
    afterReject: unlinkChildrenOfRejectedResult,
  },
  INDICATORS: {
    key: "INDICATORS", labelKey: "setup.area.indicators", fields: ["indicators"], dependsOn: ["LOGFRAME"], applyOrder: 3,
    items: (p) => p.indicators.length, accepted: (p) => countAccepted(p.indicators),
  },
  PERIODS: {
    key: "PERIODS", labelKey: "setup.area.periods", fields: ["periods"], dependsOn: ["FACTS"], applyOrder: 4, alwaysPresent: true,
    items: (p) => p.periods.length, accepted: (p) => countAccepted(p.periods),
  },
  PLAN: {
    key: "PLAN", labelKey: "setup.area.plan", fields: ["plan"], dependsOn: ["LOGFRAME", "PERIODS"], applyOrder: 6,
    items: (p) => p.plan.length, accepted: (p) => countAccepted(p.plan),
  },
  // Places are APPLIED before the plan (the work-plan import links each row's location to a place in the list, so the places must
  // exist first) but EXTRACTED after it (they are recognised from the plan's locations): `dependsOn` governs reading and skipping, not apply order.
  PLACES: {
    key: "PLACES", labelKey: "setup.area.places", fields: ["places"], dependsOn: ["PLAN", "FACTS"], applyOrder: 5,
    items: (p) => p.places.length, accepted: (p) => countAccepted(p.places),
  },
  FUNDING_BUDGET: {
    key: "FUNDING_BUDGET", labelKey: "setup.area.fundingBudget", fields: ["funding", "budget"], dependsOn: ["FACTS"], applyOrder: 7,
    items: (p) => p.funding.length + p.budget.length,
    accepted: (p) => countAccepted(p.funding) + countAccepted(p.budget),
    // The wizard creates budget lines itself (its BUDGET_LINES step), so the plain apply's "not created automatically" note would contradict it.
    launchNoteHidden: isBudgetNotAppliedNote,
  },
  RISKS: {
    key: "RISKS", labelKey: "setup.area.risks", fields: ["risks"], dependsOn: [], applyOrder: 8,
    items: (p) => p.risks.length, accepted: (p) => countAccepted(p.risks),
  },
};

export const SETUP_AREA_KEYS: readonly SetupAreaKey[] = Object.keys(SETUP_AREAS) as SetupAreaKey[];

/** The areas in apply order, independent of key order. */
export const SETUP_AREA_APPLY_ORDER: readonly SetupAreaKey[] = [...SETUP_AREA_KEYS].sort(
  (a, b) => SETUP_AREAS[a].applyOrder - SETUP_AREAS[b].applyOrder,
);
