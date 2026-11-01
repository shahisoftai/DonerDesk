/**
 * Getting a document ready to be read (Phase 36 optimisation): the model should see the words, not the grid they sit in.
 * Pure text functions, no I/O:
 *  - `compactSheetText` drops the empty cells at the end of a spreadsheet row, rounds float noise (5661165.9616999999), and
 *    turns a Gantt chart's "x" marks into the weeks they cover (a row of 40 empty columns says nothing; "scheduled Aug Wk-1
 *    to Aug Wk-3" does).
 *  - `dropNearDuplicates` leaves out a file that repeats another one almost line for line, so the same text is not read twice.
 * Nothing here adds a fact: a row keeps its words, and a dropped file is named.
 */

const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const WEEK = /^wk\s*-?\s*\d+$/i;

/** A long float written by a spreadsheet (1.1000000000000001) as the number a person typed. */
const tidyNumber = (cell: string): string => {
  if (!/^-?\d+\.\d{9,}$/.test(cell)) return cell;
  const n = Number(cell);
  return Number.isFinite(n) ? String(Number(n.toPrecision(12))) : cell;
};

interface WeekColumn {
  /** "August, 2023 Wk - 1": the sheet's own words. */
  label: string;
  /** The week as plain days, when the sheet's months give a year. */
  start: string | null;
  end: string | null;
}

interface Calendar {
  /** First column holding a week label. */
  firstColumn: number;
  weeks: ReadonlyMap<number, WeekColumn>;
}

const MONTH_NUMBERS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Week n of a month is days 7(n-1)+1 to 7n, and the last week runs to the end of the month. One fixed rule, written next to
 * the dates it makes, so a person can see where they came from (the sheet's own week label stays beside them).
 */
function weekDays(year: number, month: number, week: number): { start: string; end: string } {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startDay = Math.min((week - 1) * 7 + 1, last);
  const endDay = week >= 5 ? last : Math.min(week * 7, last);
  return { start: `${year}-${pad(month + 1)}-${pad(startDay)}`, end: `${year}-${pad(month + 1)}-${pad(endDay)}` };
}

/** The week header of a Gantt sheet and the month row above it, or null when the sheet is not a Gantt chart. */
function findCalendar(rows: ReadonlyArray<ReadonlyArray<string>>, from: number): { calendar: Calendar; at: number } | null {
  for (let r = from; r < Math.min(rows.length, from + 40); r++) {
    const row = rows[r]!;
    const weekColumns = row.flatMap((cell, c) => (WEEK.test(cell.trim()) ? [c] : []));
    if (weekColumns.length < 6) continue;
    const monthRow = rows.slice(Math.max(0, r - 3), r).reverse().find((candidate) => candidate.filter((cell) => MONTH.test(cell.trim())).length >= 2);
    // The months in order, each with the column it starts at; a year the label gives is kept, the others are worked out from
    // their neighbours (a month that comes after December of the year before is in the next year).
    const months: { col: number; text: string; index: number; year: number | null }[] = [];
    for (let c = 0; c < (monthRow?.length ?? 0); c++) {
      const text = monthRow![c]!.trim();
      if (!text || !MONTH.test(text)) continue;
      const index = MONTH_NUMBERS.indexOf(text.slice(0, 3).toLowerCase());
      const year = /\b(20\d\d)\b/.exec(text)?.[1];
      months.push({ col: c, text, index, year: year ? Number(year) : null });
    }
    for (let i = 1; i < months.length; i++) if (months[i]!.year === null && months[i - 1]!.year !== null) months[i]!.year = months[i - 1]!.year! + (months[i]!.index < months[i - 1]!.index ? 1 : 0);
    for (let i = months.length - 2; i >= 0; i--) if (months[i]!.year === null && months[i + 1]!.year !== null) months[i]!.year = months[i + 1]!.year! - (months[i]!.index > months[i + 1]!.index ? 1 : 0);
    const weeks = new Map<number, WeekColumn>();
    for (const c of weekColumns) {
      const month = [...months].reverse().find((m) => m.col <= c);
      const text = row[c]!.trim();
      const label = `${month ? `${month.text} ` : ""}${text}`.replace(/\s+/g, " ");
      const number = Number(/\d+/.exec(text)?.[0]);
      const days = month && month.year !== null && month.index >= 0 && number >= 1 ? weekDays(month.year, month.index, number) : null;
      weeks.set(c, { label, start: days?.start ?? null, end: days?.end ?? null });
    }
    return { calendar: { firstColumn: Math.min(...weekColumns), weeks }, at: r };
  }
  return null;
}

/** "[scheduled 2023-07-22 to 2023-08-07 (July Wk -4 to August, 2023 Wk - 1)]": the dates and the words they come from. */
function scheduledLabel(first: WeekColumn, last: WeekColumn): string {
  const words = first.label === last.label ? first.label : `${first.label} to ${last.label}`;
  return first.start && last.end ? `[scheduled ${first.start} to ${last.end} (${words})]` : `[scheduled ${words}]`;
}

const ROW_START = /^(\d+(?:\.\d+)*|(task|tache|tarea|component)\b.*\d|#.*)$/i;

/** A line that carries on the row above it: it has more cells, and its first cell is text, not a code or a heading. */
const continuesRow = (cells: ReadonlyArray<string>): boolean => cells.length > 1 && cells[0]!.trim() !== "" && !ROW_START.test(cells[0]!.trim());

/** Tab-separated sheet text with the grid noise removed; text that is not tab-separated passes through unchanged. */
export function compactSheetText(text: string): string {
  if (!text.includes("\t")) return text;
  const rows = text.split(/\r?\n/).map((line) => line.split("\t").map(tidyNumber));
  const out: string[] = [];
  let calendar: Calendar | null = null;
  let calendarAt = -1;
  for (let r = 0; r < rows.length; r++) {
    if (calendar === null || r > calendarAt + 400) {
      const found = findCalendar(rows, r);
      if (found && found.at >= r) { calendar = found.calendar; calendarAt = found.at; }
    }
    let cells = rows[r]!;
    // A title typed over several lines splits its Gantt row: the code and the start of the title on one line, the rest of the
    // title, the target and the "x" marks on the next. The pieces are put back together (a space for each break) before the
    // marks are read, so the row keeps its code and its weeks.
    while (calendar && r > calendarAt && cells.length <= 2 && r + 1 < rows.length && continuesRow(rows[r + 1]!)) {
      cells = `${cells.join("\t")} ${rows[r + 1]!.join("\t")}`.split("\t");
      r += 1;
    }
    // A new sheet in the workbook starts its own calendar.
    if (cells.length === 1 && cells[0]!.startsWith("# ")) { calendar = null; calendarAt = -1; }
    if (calendar && r > calendarAt) {
      const marked = cells.flatMap((cell, c) => (c >= calendar!.firstColumn && /^x+$/i.test(cell.trim()) ? [c] : []));
      if (marked.length > 0) {
        const first = calendar.weeks.get(marked[0]!);
        const last = calendar.weeks.get(marked[marked.length - 1]!);
        const label = first && last ? scheduledLabel(first, last) : null;
        cells = [...cells.slice(0, calendar.firstColumn), ...(label ? [label] : [])];
      }
    }
    while (cells.length > 0 && cells[cells.length - 1]!.trim() === "") cells = cells.slice(0, -1);
    // The Gantt's own header rows (weeks, empty months) carry only the labels the rows above already use.
    if (calendar && r === calendarAt) continue;
    out.push(cells.join("\t"));
  }
  return out.join("\n");
}

const normalised = (line: string): string => line.toLowerCase().replace(/\s+/g, " ").trim();

/** How much of the smaller of two texts the other repeats, line for line (short lines are ignored). */
export function overlapRatio(a: string, b: string): number {
  const lines = (t: string) => new Set(t.split(/\r?\n/).map(normalised).filter((l) => l.length >= 25));
  const left = lines(a);
  const right = lines(b);
  const smaller = Math.min(left.size, right.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const line of left) if (right.has(line)) shared += 1;
  return shared / smaller;
}

export interface PreparedDocument {
  name: string;
  text: string;
}

/**
 * Keeps one of any two documents that repeat each other (a draft and its revision): the longer, else the one listed first.
 * Returns the kept documents in their original order and the names of the ones left out.
 */
export function dropNearDuplicates<T extends PreparedDocument>(documents: ReadonlyArray<T>, threshold = 0.85): { kept: T[]; dropped: string[] } {
  const dropped = new Set<number>();
  for (let i = 0; i < documents.length; i++) {
    if (dropped.has(i)) continue;
    for (let j = i + 1; j < documents.length; j++) {
      if (dropped.has(j) || overlapRatio(documents[i]!.text, documents[j]!.text) < threshold) continue;
      dropped.add(documents[j]!.text.length > documents[i]!.text.length ? i : j);
      if (dropped.has(i)) break;
    }
  }
  return { kept: documents.filter((_, i) => !dropped.has(i)), dropped: documents.filter((_, i) => dropped.has(i)).map((d) => d.name) };
}
