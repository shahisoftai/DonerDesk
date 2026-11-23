/**
 * The project's setup checklist (Phase 65): what makes a project fuller after launch, with guidance. One table of rules over what the
 * project already has; each rule is one item. A rule says why the item matters, how long it takes, and where its one action lives, and is
 * offered only to people who can do it. Pure: no React, no fetch, no clock (the caller says how soon the next report is due).
 *
 * Adding an item is a row; nothing branches on an item's id. Progress counts only the items the person may act on.
 */
export type ChecklistGroup = "ESSENTIALS" | "TEAM" | "PLACES" | "WORK_PLAN" | "REPORTING" | "FINANCE" | "RISKS";

export interface ChecklistFacts {
  indicators: number;
  periods: number;
  /** People on the project, the person included. */
  teamSize: number;
  /** A place the plan or the work has pinned. */
  hasSites: boolean;
  planningVisible: boolean;
  plannedActivities: number;
  /** Donor templates attached to the project. */
  templates: number;
  /** The project has a budget or funding recorded. */
  hasBudget: boolean;
  risks: number;
}

export interface ChecklistRule {
  id: string;
  group: ChecklistGroup;
  title: string;
  /** Why it matters, one sentence. */
  why: string;
  /** How long it takes, in words ("About 5 minutes"). */
  effort: string;
  action: string;
  /** Path under `/projects/<id>`. */
  path: string;
  /** The person needs ANY of these to do it; absent = anyone. */
  anyOf?: readonly string[];
  /** Part of what the next report needs: rises to the top when a report is near. */
  forReport: boolean;
  /** Not offered when the rule says the project does not use this (for example work planning hidden). */
  applies?: (facts: ChecklistFacts) => boolean;
  done: (facts: ChecklistFacts) => boolean;
}

export const CHECKLIST_RULES: readonly ChecklistRule[] = [
  { id: "indicators", group: "ESSENTIALS", title: "Add your indicators", why: "Every figure you report is an indicator value; without them there is nothing to record.", effort: "About 10 minutes", action: "Open the results framework", path: "/logframe", anyOf: ["logframe.edit", "project.edit"], forReport: true, done: (f) => f.indicators > 0 },
  { id: "period", group: "ESSENTIALS", title: "Create the first reporting period", why: "Values are recorded against a period, and a report is written for one.", effort: "About 2 minutes", action: "Create a period", path: "/periods", anyOf: ["reporting.create", "project.edit"], forReport: true, done: (f) => f.periods > 0 },
  { id: "team", group: "TEAM", title: "Invite your team", why: "People can only be given indicators, activities and reviews once they are on the project.", effort: "About 5 minutes", action: "Open the team", path: "/team", anyOf: ["team.invite", "team.manage"], forReport: false, done: (f) => f.teamSize > 1 },
  { id: "places", group: "PLACES", title: "Choose where you work", why: "Places let figures be recorded and mapped by district, and keep the same place named the same way everywhere.", effort: "About 5 minutes", action: "Choose areas", path: "/places", anyOf: ["project.edit"], forReport: false, done: (f) => f.hasSites },
  { id: "plan", group: "WORK_PLAN", title: "Plan your activities", why: "A work plan shows what is on time or late and what each person must do this week.", effort: "About 15 minutes", action: "Open the work plan", path: "/activities/plan", anyOf: ["workplan.manage"], forReport: false, applies: (f) => f.planningVisible, done: (f) => f.plannedActivities > 0 },
  { id: "template", group: "REPORTING", title: "Add the donor's report template", why: "The report is written to the donor's own headings and rules, so the template is needed before the first draft.", effort: "About 10 minutes", action: "Open donor templates", path: "/templates", anyOf: ["reporting.edit", "template.create"], forReport: true, done: (f) => f.templates > 0 },
  { id: "budget", group: "FINANCE", title: "Record the funding and budget", why: "Spending is shown against what was funded, and finance reports need both.", effort: "About 10 minutes", action: "Open finance", path: "/finance", anyOf: ["finance.view"], forReport: false, applies: (f) => f.planningVisible, done: (f) => f.hasBudget },
  { id: "risks", group: "RISKS", title: "Note the main risks and assumptions", why: "A risk written down early can be reviewed on a date; one remembered late is a surprise.", effort: "About 5 minutes", action: "Open the project home", path: "", anyOf: ["risk.raise", "risk.manage"], forReport: false, applies: (f) => f.planningVisible, done: (f) => f.risks > 0 },
];

export interface ChecklistItem { id: string; group: ChecklistGroup; title: string; why: string; effort: string; action: string; path: string; done: boolean; forReport: boolean }
export interface Checklist { items: ChecklistItem[]; done: number; total: number; complete: boolean }

/** The checklist for this person: open items first (those a near report needs first), then the done ones. */
export function setupChecklist(input: { facts: ChecklistFacts; capabilities: ReadonlySet<string>; reportDueWithinDays: number | null }): Checklist {
  const near = input.reportDueWithinDays !== null && input.reportDueWithinDays <= 30;
  const mine = CHECKLIST_RULES.filter((r) => (!r.applies || r.applies(input.facts)) && (!r.anyOf || r.anyOf.some((c) => input.capabilities.has(c))));
  const items: ChecklistItem[] = mine.map((r, order) => ({ order, item: { id: r.id, group: r.group, title: r.title, why: r.why, effort: r.effort, action: r.action, path: r.path, done: r.done(input.facts), forReport: r.forReport } }))
    .sort((a, b) => Number(a.item.done) - Number(b.item.done) || (near ? Number(b.item.forReport) - Number(a.item.forReport) : 0) || a.order - b.order)
    .map((x) => x.item);
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, complete: items.length > 0 && done === items.length };
}
