/**
 * The plan as a spreadsheet (CSV), and a few words per activity for its own fields. Pure, so it is unit-tested.
 * Cells that a spreadsheet would run as a formula (starting with = + - @ or a tab or return) are written with a leading
 * apostrophe, so a title typed as "=HYPERLINK(...)" is shown as text and never run.
 */
export interface ExportRow {
  id: string;
  title: string;
  kind: string;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  signalLabel: string;
  ownerUserId?: string | undefined;
  location?: string | undefined;
  waitingFor: ReadonlyArray<{ title: string }>;
}

export interface ExportField { id: string; label: string }

/** One CSV cell: formulas neutralised, then quoted when it holds a comma, quote or line break. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const STATUS_WORDS: Record<string, string> = { PLANNED: "Not started", IN_PROGRESS: "Under way", DONE: "Done", CANCELLED: "Cancelled" };

export function planCsv(input: {
  rows: ReadonlyArray<ExportRow>;
  fields: ReadonlyArray<ExportField>;
  /** itemId -> fieldId -> value (only fields with a value). */
  values: Readonly<Record<string, Readonly<Record<string, string>>>>;
  names: Readonly<Record<string, string>>;
}): string {
  const header = ["Activity", "Type", "Starts", "Ends", "Status", "Signal", "Lead", "Location", "Waiting for", ...input.fields.map((f) => f.label)];
  const lines = [header.map(csvCell).join(",")];
  const sorted = [...input.rows].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title));
  for (const r of sorted) {
    const own = input.values[r.id] ?? {};
    const cells = [
      r.title, r.kind === "MILESTONE" ? "Milestone" : "Activity", r.plannedStart, r.plannedEnd, STATUS_WORDS[r.status] ?? r.status, r.signalLabel,
      r.ownerUserId ? input.names[r.ownerUserId] ?? "A team member" : "", r.location ?? "", r.waitingFor.map((w) => w.title).join("; "),
      ...input.fields.map((f) => own[f.id] ?? ""),
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** "Donor code: X1" for each field the activity has a value for; a blank field is left out, not shown as empty. */
export function fieldChips(fields: ReadonlyArray<ExportField>, own: Readonly<Record<string, string>> | undefined): string[] {
  if (!own) return [];
  return fields.filter((f) => (own[f.id] ?? "") !== "").map((f) => `${f.label}: ${own[f.id]}`);
}
