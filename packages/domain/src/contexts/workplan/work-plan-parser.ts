/**
 * Reads a work plan from pasted or uploaded text (columns: Logframe Code, Title, Start, End, Lead email, Location,
 * Sessions, Repeats). Pure: it only reads. Every row that cannot be understood is reported with its row number, and the
 * import applies only when there are no problems (the Data Center rule: any bad row blocks the whole import).
 */
import { normalizeHeader, splitDelimited } from "../../core/delimited.js";
import { isPlainDate, toPlainDate, type PlainDate } from "./plain-date.js";

export interface ParsedPlanRow {
  /** 1-based row number among the data rows, for messages. */
  row: number;
  logframeCode?: string;
  title: string;
  start: PlainDate;
  end: PlainDate;
  leadEmail?: string;
  location?: string;
  sessions?: number;
  repeats?: "WEEK" | "MONTH";
}

export interface ParsedPlan {
  rows: ParsedPlanRow[];
  problems: string[];
}

const COLUMNS = {
  code: ["logframecode", "code", "outputcode", "activitycode", "logframeactivity", "outputoractivitycode"],
  title: ["title", "activity", "activitytitle", "plannedactivity"],
  start: ["start", "startdate", "starts", "from"],
  end: ["end", "enddate", "ends", "to"],
  lead: ["leademail", "lead", "owner", "owneremail", "email"],
  location: ["location", "place", "venue"],
  sessions: ["sessions", "numberofsessions", "visits"],
  repeats: ["repeats", "repeat", "recurrence"],
} as const;

const REPEATS: Readonly<Record<string, "WEEK" | "MONTH" | undefined>> = { "": undefined, no: undefined, none: undefined, weekly: "WEEK", week: "WEEK", "every week": "WEEK", monthly: "MONTH", month: "MONTH", "every month": "MONTH" };

function parseDay(value: string | undefined): PlainDate | undefined {
  const v = value?.trim();
  if (!v || /^\d+$/.test(v)) return undefined; // an Excel serial number is not a date we can trust
  if (isPlainDate(v)) return v;
  const d = new Date(`${v} UTC`);
  return Number.isNaN(d.getTime()) ? undefined : toPlainDate(d);
}

export function parseWorkPlanText(text: string): ParsedPlan {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  // Lines are not trimmed: a leading tab is an empty first cell, and dropping it would shift every column.
  const first = lines[0];
  if (!first) return { rows: [], problems: ["There is nothing to import yet."] };
  const delimiter = first.includes("\t") ? "\t" : first.includes(",") ? "," : first.includes(";") ? ";" : "";
  const headers = splitDelimited(first, delimiter || undefined).map(normalizeHeader);
  const col = (names: ReadonlyArray<string>) => headers.findIndex((h) => names.includes(h));
  const at = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, col(names)])) as Record<keyof typeof COLUMNS, number>;
  if (at.title === -1 || at.start === -1) return { rows: [], problems: ["The first row must name the columns, including Title and Start."] };

  const rows: ParsedPlanRow[] = [];
  const problems: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitDelimited(line, delimiter || undefined);
    const cell = (c: number) => (c >= 0 ? cells[c]?.trim() || undefined : undefined);
    const row = index + 1;
    const title = cell(at.title);
    const start = parseDay(cell(at.start));
    const rawEnd = cell(at.end);
    const end = rawEnd ? parseDay(rawEnd) : start;
    const sessionsRaw = cell(at.sessions);
    const repeatsRaw = (cell(at.repeats) ?? "").toLowerCase();
    const leadEmail = cell(at.lead)?.toLowerCase();
    const issues: string[] = [];
    if (!title) issues.push("give it a title");
    if (!start) issues.push("start must be a date such as 2026-03-12");
    if (rawEnd && !end) issues.push("end must be a date such as 2026-03-12");
    if (start && end && end < start) issues.push("end is before the start");
    if (sessionsRaw && !/^[1-9]\d*$/.test(sessionsRaw)) issues.push("sessions must be a whole number of 1 or more");
    if (!(repeatsRaw in REPEATS)) issues.push("repeats must be No, Weekly or Monthly");
    if (leadEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) issues.push("lead must be an email address");
    if (issues.length) {
      problems.push(`Row ${row}: ${issues.join("; ")}.`);
      return;
    }
    rows.push({
      row, title: title!, start: start!, end: end!,
      ...(cell(at.code) ? { logframeCode: cell(at.code)! } : {}),
      ...(leadEmail ? { leadEmail } : {}),
      ...(cell(at.location) ? { location: cell(at.location)! } : {}),
      ...(sessionsRaw ? { sessions: Number(sessionsRaw) } : {}),
      ...(REPEATS[repeatsRaw] ? { repeats: REPEATS[repeatsRaw]! } : {}),
    });
  });
  if (rows.length === 0 && problems.length === 0) problems.push("There are no activities under the column names.");
  return { rows, problems };
}
