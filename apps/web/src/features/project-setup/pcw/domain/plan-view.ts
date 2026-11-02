import type { LogframeNodeDef, PlaceDef, PlanSetup, IndicatorDef } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

type PlanItem = SetupDraftView["plan"][number];

const EMPTY: PlanSetup = { placeNames: [], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false };

export interface PlanRow {
  item: PlanItem;
  setup: PlanSetup;
}

/** Each planned activity with what the person has decided for it (an empty set of links when nothing yet). */
export function planRows(view: SetupDraftView): PlanRow[] {
  return view.plan.map((item) => ({ item, setup: view.extras.planSetup[item.planKey] ?? EMPTY }));
}

/** The project's activities from the results framework, which a planned activity belongs to. */
export function activityOptions(view: SetupDraftView): Array<{ code: string; label: string }> {
  return view.logframe.flatMap((i) => {
    const n = i.value as LogframeNodeDef;
    return n.level === "ACTIVITY" && n.code ? [{ code: n.code, label: `${n.code} · ${n.title ?? ""}` }] : [];
  });
}

export function placeNames(view: SetupDraftView): string[] {
  return view.places.flatMap((i) => ((i.value as PlaceDef).name ? [(i.value as PlaceDef).name as string] : []));
}

export function indicatorOptions(view: SetupDraftView): Array<{ code: string; label: string }> {
  return view.indicators.flatMap((i) => {
    const v = i.value as IndicatorDef;
    return v.code ? [{ code: v.code, label: `${v.code} · ${v.title ?? ""}` }] : [];
  });
}

const toggle = (list: readonly string[], value: string, on: boolean): string[] => (on ? [...new Set([...list, value])] : list.filter((x) => x !== value));

/** The patch that adds or removes one place; choosing a place ends "project-wide". */
export const placePatch = (setup: PlanSetup, name: string, on: boolean) => ({ placeNames: toggle(setup.placeNames, name, on), ...(on ? { projectWide: false } : {}) });
/** The patch for "project-wide"; it clears the named places, because the two are different answers. */
export const projectWidePatch = (on: boolean) => (on ? { projectWide: true, placeNames: [] as string[] } : { projectWide: false });
export const indicatorPatch = (setup: PlanSetup, code: string, on: boolean) => ({ indicatorCodes: toggle(setup.indicatorCodes, code, on) });

/** "Cars, Forms" -> ["Cars", "Forms"]. */
export function parseFiles(text: string): string[] {
  return [...new Set(text.split(",").map((t) => t.trim()).filter(Boolean))];
}

/** A share, never above a whole: 0 of 0 is complete (nothing to do). */
export function share(done: number, total: number): number {
  return total <= 0 ? 1 : Math.min(1, Math.max(0, done / total));
}

/** Suggestions grouped by activity, so the screen can show them next to the row they belong to. */
export function suggestionsByRow(view: SetupDraftView): Map<string, SetupDraftView["suggestions"]> {
  const out = new Map<string, SetupDraftView["suggestions"]>();
  for (const s of view.suggestions) out.set(s.planKey, [...(out.get(s.planKey) ?? []), s]);
  return out;
}

/** The name a suggestion's target goes by on screen: an indicator's code and title, a place's name, a team member's name. */
export function suggestionTarget(view: SetupDraftView, s: SetupDraftView["suggestions"][number]): string {
  if (s.kind === "INDICATOR") return indicatorOptions(view).find((o) => o.code === s.value)?.label ?? s.value;
  if (s.kind === "LEAD") return view.extras.team.find((p) => p.key === s.value)?.name ?? s.value;
  return s.value;
}
