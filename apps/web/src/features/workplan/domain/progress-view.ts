/**
 * What the progress-log form starts with. Pure: the same domain rules the server enforces, used so the form can prefill a
 * monthly or activity-end report from the entries it covers, open an existing entry instead of making a second one, and explain a
 * clash before saving. Blank stays blank everywhere.
 */
import {
  PROGRESS_KIND_LABEL, overlapping, progressRange, sourcesFor, sumValues, weekStartOf,
  type LiveEntry, type PlainDate, type ProgressField, type ProgressKind,
} from "@donordesk/domain/contexts/workplan/index.js";

export interface ProgressEntryView {
  id: string;
  kind: ProgressKind;
  from: string;
  to: string;
  values: { total: number | null; breakdowns: Record<string, number | null>; sessions: number | null; unique: number | null };
  narrative: { notes: string; summary: string; achievements: string; challenges: string; nextSteps: string; lessons: string };
  absorbedById: string | null;
}

export interface ProgressDraft {
  key: string;
  total: string;
  breakdowns: Record<string, string>;
  sessions: string;
  unique: string;
  narrative: ProgressEntryView["narrative"];
  /** The saved entry being edited, or null for a new one. */
  editingId: string | null;
  /** One plain sentence about where the figures came from. */
  note: string;
  error?: string;
}

const text = (n: number | null): string => (n === null ? "" : String(n));
export const KINDS: ProgressKind[] = ["DAILY", "WEEKLY", "MONTHLY", "END"];
export { PROGRESS_KIND_LABEL };

const toLive = (entries: ReadonlyArray<ProgressEntryView>): LiveEntry[] =>
  entries.map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, values: e.values, absorbedById: e.absorbedById }));

const clamp = (d: PlainDate, act: { start: PlainDate; end: PlainDate }): PlainDate => (d < act.start ? act.start : d > act.end ? act.end : d);

/** The date, week start, month or nothing a form opens on: today inside the activity's dates. */
export function defaultKey(kind: ProgressKind, today: PlainDate, act: { start: PlainDate; end: PlainDate }): string {
  const day = clamp(today, act);
  if (kind === "DAILY") return day;
  if (kind === "WEEKLY") return weekStartOf(day);
  if (kind === "MONTHLY") return day.slice(0, 7);
  return "";
}

const blankNarrative: ProgressEntryView["narrative"] = { notes: "", summary: "", achievements: "", challenges: "", nextSteps: "", lessons: "" };

export function draftFor(
  kind: ProgressKind, key: string, act: { start: PlainDate; end: PlainDate }, entries: ReadonlyArray<ProgressEntryView>, fields: ReadonlyArray<ProgressField>,
  /** People linked to the activity by case code, each once: the starting point for the activity-end "unique people". */
  uniquePeople: number | null = null,
): ProgressDraft {
  const blank = (error?: string, note = ""): ProgressDraft => ({
    key, total: "", breakdowns: Object.fromEntries(fields.map((f) => [f.key, ""])), sessions: "", unique: "", narrative: { ...blankNarrative },
    editingId: null, note, ...(error ? { error } : {}),
  });
  const range = progressRange(kind, key, act);
  if (!range.ok) return blank(range.error.message);

  const existing = entries.find((e) => e.kind === kind && e.from === range.value.from);
  const clash = overlapping(toLive(entries), kind, range.value, existing?.id);
  if (clash) {
    const where = clash.kind === "MONTHLY" ? "That month is already reported" : `${clash.from} is already logged`;
    return blank(`${where}. Open that entry to change it.`);
  }
  if (existing) {
    return {
      key, total: text(existing.values.total), breakdowns: Object.fromEntries(fields.map((f) => [f.key, text(existing.values.breakdowns[f.key] ?? null)])),
      sessions: text(existing.values.sessions), unique: text(existing.values.unique), narrative: { ...existing.narrative },
      editingId: existing.id, note: `Editing the saved ${PROGRESS_KIND_LABEL[kind].toLowerCase()} entry.`,
    };
  }
  if (kind === "DAILY" || kind === "WEEKLY") return blank(undefined, "Enter what was reached. A blank figure means not recorded.");

  const sources = sourcesFor(kind, range.value, toLive(entries));
  const sum = sumValues(sources, fields);
  const note = sources.length
    ? `Filled from ${sources.length} ${sources.length === 1 ? "entry" : "entries"}. A blank figure means not recorded. Change anything that is wrong.`
    : kind === "MONTHLY" ? "No daily or weekly entries cover this month yet. Enter the figures, or log the days first." : "No entries yet. Enter the whole-activity figures.";
  return {
    key, total: text(sum.total), breakdowns: Object.fromEntries(fields.map((f) => [f.key, text(sum.breakdowns[f.key] ?? null)])),
    sessions: text(sum.sessions), unique: kind === "END" && uniquePeople ? String(uniquePeople) : "", narrative: { ...blankNarrative }, editingId: null,
    note: kind === "END" && uniquePeople ? `${note} Unique people is the ${uniquePeople} linked to this activity by case code.` : note,
  };
}

/** People reached so far: the live entries only (an absorbed entry is already inside its monthly report), or null when nothing is recorded. */
export function reachedSoFar(entries: ReadonlyArray<ProgressEntryView>): number | null {
  const xs = entries.filter((e) => e.kind !== "END" && e.absorbedById === null).map((e) => e.values.total).filter((n): n is number => n !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}

/** The key a saved entry reopens with. */
export function keyOf(entry: Pick<ProgressEntryView, "kind" | "from">): string {
  if (entry.kind === "END") return "";
  return entry.kind === "MONTHLY" ? entry.from.slice(0, 7) : entry.from;
}
