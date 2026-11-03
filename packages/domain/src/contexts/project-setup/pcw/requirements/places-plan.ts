/** Requirements of slides 5 (Places) and 6 (Work plan). */
import { planKeyOf, type SetupDraft } from "../draft.js";
import type { RequirementDef } from "../requirement.js";
import { MET, allOf, live, open, present, undecidedCount } from "./shared.js";

const planRows = (d: SetupDraft) => live(d.proposal.plan).map((def) => ({ def, key: planKeyOf(def), setup: d.extras.planSetup[planKeyOf(def)] }));
const named = (title: string | null, key: string): string => title ?? key;

/** Logframe activities nobody has planned work for. */
export const uncoveredActivities = (d: SetupDraft): string[] => {
  const rows = live(d.proposal.plan);
  return live(d.proposal.logframe).filter((n) => n.level === "ACTIVITY" && !rows.some((r) => r.logframeCode !== null && r.logframeCode === n.code)).map((n) => n.code ?? n.title ?? "?");
};

/** Planned activities missing dates, a place (or "project-wide") or a lead on the team. */
export const incompletePlans = (d: SetupDraft): string[] => {
  const team = new Set(d.extras.team.map((p) => p.key));
  return planRows(d)
    .filter(({ def, setup }) => {
      const placed = setup !== undefined && (setup.projectWide || setup.placeNames.length > 0);
      const lead = setup?.leadKey;
      return def.start === null || def.end === null || !placed || lead === undefined || !team.has(lead);
    })
    .map(({ def, key }) => named(def.title, key));
};

/** Indicators no activity feeds and that have no collection method of their own. */
export const unfedIndicators = (d: SetupDraft): string[] => {
  const fed = new Set(planRows(d).flatMap(({ setup }) => setup?.indicatorCodes ?? []));
  return live(d.proposal.indicators)
    .filter((i) => i.code === null || (!fed.has(i.code) && d.extras.indicatorSetup[i.code]?.method === undefined))
    .map((i) => i.code ?? i.title ?? "?");
};

export const PLACES_REQUIREMENTS: readonly RequirementDef[] = [
  {
    // A project with no named places answers "not used".
    key: "places.decided", slide: "PLACES", coversSteps: [16], allowsNotUsed: true,
    check: (d) => {
      if (d.proposal.places.length === 0) return open("placesEmpty");
      const n = undecidedCount(d.proposal.places);
      return n === 0 ? MET : open("placesUndecided", { count: n });
    },
  },
  {
    key: "places.area", slide: "PLACES", coversSteps: [17, 18], allowsNotUsed: true,
    check: (d) => (present(d.extras.projectArea) ? MET : open("projectAreaMissing")),
  },
];

export const PLAN_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "plan.decided", slide: "WORK_PLAN", coversSteps: [19], allowsNotUsed: false,
    check: (d) => {
      const n = undecidedCount(d.proposal.plan);
      return n === 0 ? MET : open("planUndecided", { count: n });
    },
  },
  {
    key: "plan.coverage", slide: "WORK_PLAN", coversSteps: [19, 20], allowsNotUsed: false,
    check: (d) => (planRows(d).length === 0 ? open("planEmpty") : allOf(uncoveredActivities(d), "activityWithoutPlan")),
  },
  {
    key: "plan.complete", slide: "WORK_PLAN", coversSteps: [21, 23, 24, 33], allowsNotUsed: false,
    check: (d) => allOf(incompletePlans(d), "planIncomplete"),
  },
  {
    // An activity that feeds no indicator is allowed when the person says so.
    key: "plan.indicators", slide: "WORK_PLAN", coversSteps: [22], allowsNotUsed: true,
    check: (d) => allOf(planRows(d).filter(({ setup }) => (setup?.indicatorCodes.length ?? 0) === 0).map(({ def, key }) => named(def.title, key)), "planWithoutIndicator"),
  },
  {
    key: "plan.indicatorFed", slide: "WORK_PLAN", coversSteps: [22], allowsNotUsed: false,
    check: (d) => allOf(unfedIndicators(d), "indicatorNotFed"),
  },
];
