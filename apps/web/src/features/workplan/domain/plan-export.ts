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

/** Budget per activity in one currency (from the project budget): amounts in minor units. */
export interface ExportBudget { currency: string; byActivity: ReadonlyArray<{ activityId: string; budgetedMinor: number; spentMinor: number }> }

/** 125050 -> "1250.50": a plain number for a spreadsheet, no thousands separator or currency sign. */
export const minorToDecimal = (minor: number): string => `${minor < 0 ? "-" : ""}${Math.trunc(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;

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
  /** One block per currency; an activity with no budget in a currency gets empty cells, never zeros. */
  budget?: ReadonlyArray<ExportBudget>;
}): string {
  const budget = input.budget ?? [];
  const header = [
    "Activity", "Type", "Starts", "Ends", "Status", "Signal", "Lead", "Location", "Waiting for", ...input.fields.map((f) => f.label),
    ...budget.flatMap((b) => [`Budget (${b.currency})`, `Spent (${b.currency})`]),
  ];
  const lines = [header.map(csvCell).join(",")];
  const sorted = [...input.rows].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title));
  for (const r of sorted) {
    const own = input.values[r.id] ?? {};
    const cells = [
      r.title, r.kind === "MILESTONE" ? "Milestone" : "Activity", r.plannedStart, r.plannedEnd, STATUS_WORDS[r.status] ?? r.status, r.signalLabel,
      r.ownerUserId ? input.names[r.ownerUserId] ?? "A team member" : "", r.location ?? "", r.waitingFor.map((w) => w.title).join("; "),
      ...input.fields.map((f) => own[f.id] ?? ""),
      ...budget.flatMap((b) => {
        const line = b.byActivity.find((a) => a.activityId === r.id);
        return line ? [minorToDecimal(line.budgetedMinor), minorToDecimal(line.spentMinor)] : ["", ""];
      }),
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
