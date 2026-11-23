import type { OfflinePack } from "./offline-pack.ts";

/**
 * What the field app shows first (Phase 64): the person's day and week, worked out from the work downloaded to the phone, with no clock of
 * its own (today is passed in) and no words (screens turn the codes below into the person's language). Pure, so the order of things on the
 * screen is a rule that is tested, not an accident of the layout.
 */
export type PartOfDay = "MORNING" | "AFTERNOON" | "EVENING" | "HELLO";

/** The greeting by the hour on the phone: morning 5-11, afternoon 12-16, evening 17-21, otherwise a plain hello. */
export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 22) return "EVENING";
  return "HELLO";
}

/** "Pasha Piracha" → "Pasha". An empty name gives an empty first name (the greeting then has no name). */
export function firstName(full: string | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The phone's own calendar day as `YYYY-MM-DD` (a person's "today" is where they are, not UTC). */
export function plainDateOf(at: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

const DAY = 86_400_000;
const dayNumber = (plain: string): number => Math.round(Date.parse(`${plain}T00:00:00Z`) / DAY);

export type DueKind = "OVERDUE" | "TODAY" | "TOMORROW" | "SOON" | "LATER" | "NONE";
export interface Due { kind: DueKind; days: number }

/** How far off a due day is. SOON is 2 to 7 days; LATER is further. `days` is how many days late or ahead (0 for today and no date). */
export function dueOf(dueOn: string | undefined, today: string): Due {
  if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { kind: "NONE", days: 0 };
  const d = dayNumber(dueOn) - dayNumber(today);
  if (d < 0) return { kind: "OVERDUE", days: -d };
  if (d === 0) return { kind: "TODAY", days: 0 };
  if (d === 1) return { kind: "TOMORROW", days: 1 };
  return { kind: d <= 7 ? "SOON" : "LATER", days: d };
}

export interface VisitTask {
  kind: "VISIT";
  id: string;
  projectId: string;
  projectName: string;
  formId: string;
  formName: string;
  placeId: string;
  placeName: string;
  /** "Dir Lower › K.P. › Pakistan": where it is. */
  path: string;
  dueOn?: string;
  started: boolean;
  due: Due;
}

export type WorkWhen = "OVERDUE" | "TODAY" | "THIS_WEEK" | "LATER";
export interface WorkTask {
  kind: "WORK";
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  location?: string;
  when: WorkWhen;
}

export type Task = VisitTask | WorkTask;

export interface TodayView {
  visits: VisitTask[];
  work: WorkTask[];
  /** The one thing to do next, or null when nothing is waiting. */
  next: Task | null;
  /** Counts for the greeting line. */
  summary: { visits: number; started: number; overdue: number; today: number };
}

const START_RANK: Record<DueKind, number> = { OVERDUE: 1, TODAY: 3, TOMORROW: 5, SOON: 5, LATER: 6, NONE: 6 };

function visitRank(v: VisitTask): number { return v.started ? 0 : START_RANK[v.due.kind]; }
function workRank(w: WorkTask): number { return w.when === "OVERDUE" ? 2 : w.when === "TODAY" ? 4 : 7; }

function workWhen(item: { plannedStart: string; plannedEnd: string }, today: string): WorkWhen {
  if (item.plannedEnd < today) return "OVERDUE";
  if (item.plannedStart <= today) return "TODAY";
  return dayNumber(item.plannedStart) - dayNumber(today) <= 7 ? "THIS_WEEK" : "LATER";
}

/** The visits given to the person and the work planned for them, in the order they should be done, from every project on the phone. */
export function buildToday(packs: ReadonlyArray<OfflinePack>, today: string): TodayView {
  const visits: VisitTask[] = [];
  const work: WorkTask[] = [];
  for (const pack of packs) {
    const placeById = new Map(pack.places.map((p) => [p.id, p]));
    const formById = new Map(pack.forms.map((f) => [f.id, f]));
    for (const a of pack.assignments ?? []) {
      const form = formById.get(a.formId);
      const place = placeById.get(a.placeId);
      if (!form || !place) continue; // a visit for a form that is not on the phone cannot be started
      visits.push({
        kind: "VISIT", id: a.id, projectId: pack.projectId, projectName: pack.projectName, formId: a.formId, formName: form.name,
        placeId: a.placeId, placeName: place.name, path: place.path, ...(a.dueOn ? { dueOn: a.dueOn } : {}),
        started: a.status === "IN_PROGRESS", due: dueOf(a.dueOn, today),
      });
    }
    for (const item of pack.plan ?? []) {
      work.push({ kind: "WORK", id: item.id, projectId: pack.projectId, projectName: pack.projectName, title: item.title, plannedStart: item.plannedStart, plannedEnd: item.plannedEnd, ...(item.location ? { location: item.location } : {}), when: workWhen(item, today) });
    }
  }
  visits.sort((a, b) => visitRank(a) - visitRank(b) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.placeName.localeCompare(b.placeName));
  work.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title));

  const candidates: Array<{ rank: number; task: Task }> = [
    ...visits.map((v) => ({ rank: visitRank(v), task: v as Task })),
    ...work.filter((w) => w.when !== "LATER").map((w) => ({ rank: workRank(w), task: w as Task })),
  ];
  // The lowest rank wins; the sort is stable, so visits (listed first) beat work of the same rank.
  const next = candidates.length === 0 ? null : candidates.reduce((best, c) => (c.rank < best.rank ? c : best)).task;
  return {
    visits, work, next,
    summary: { visits: visits.length, started: visits.filter((v) => v.started).length, overdue: visits.filter((v) => v.due.kind === "OVERDUE").length + work.filter((w) => w.when === "OVERDUE").length, today: visits.filter((v) => v.due.kind === "TODAY").length + work.filter((w) => w.when === "TODAY").length },
  };
}

export interface WeekGroup { key: string; kind: "OVERDUE" | "DAY" | "NO_DATE"; day?: string; items: Task[] }

/** The week as groups: what is late first, then each of the next seven days that has something, then what has no date. */
export function weekGroups(view: TodayView, today: string): WeekGroup[] {
  const groups: WeekGroup[] = [];
  const late: Task[] = [...view.visits.filter((v) => v.due.kind === "OVERDUE"), ...view.work.filter((w) => w.when === "OVERDUE")];
  if (late.length) groups.push({ key: "late", kind: "OVERDUE", items: late });
  const start = dayNumber(today);
  for (let i = 0; i < 7; i++) {
    const day = new Date((start + i) * DAY).toISOString().slice(0, 10);
    const items: Task[] = [
      ...view.visits.filter((v) => v.dueOn === day),
      ...view.work.filter((w) => w.when !== "OVERDUE" && w.plannedStart <= day && day <= w.plannedEnd && (i > 0 || w.plannedStart <= today)),
    ];
    if (items.length) groups.push({ key: day, kind: "DAY", day, items });
  }
  const undated = view.visits.filter((v) => v.due.kind === "NONE" || v.due.kind === "LATER");
  if (undated.length) groups.push({ key: "later", kind: "NO_DATE", items: undated });
  return groups;
}
