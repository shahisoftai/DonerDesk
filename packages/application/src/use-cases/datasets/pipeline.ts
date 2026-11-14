import {
  applyKit, applySteps, columnProblems, detectPersonalData, guessColumns, kindOverrides, kitChecks, kitOf, limitProblem, matchKit,
  placeColumnOrder, resolvePlaceValues, runChecks, semanticOf, toStoredRows, typeRows, isBlank, detectHeaderRow, stepDef,
  type CheckConfig, type ColumnDef, type ColumnProposal, type DatasetRowValues, type Finding, type PiiFinding, type PlaceMatch, type PlaceRegistry, type RawTable, type TidyStep, type Workbook,
} from "@donordesk/domain";

/**
 * The one path from a file to rows (§3.4–3.5): replay the steps, read every cell by its column's kind, match places once, and run the
 * checks. Upload, re-check, save, refresh and connector pulls all call it, so a refresh is checked exactly like the first upload.
 * Pure apart from the place registry it is given.
 */
export interface PipelineInput {
  workbook: Workbook;
  steps: readonly TidyStep[];
  /** Confirmed columns; absent = guessed (the first upload). Columns are matched to the table by their source header. */
  columns?: readonly ColumnDef[] | undefined;
  checks?: readonly CheckConfig[] | undefined;
  places?: PlaceRegistry | undefined;
  country?: string | undefined;
  extra?: ReadonlyMap<string, RawTable> | undefined;
}

export interface PipelineResult {
  table: RawTable;
  columns: ColumnDef[];
  proposals?: ColumnProposal[] | undefined;
  rows: DatasetRowValues[];
  findings: Finding[];
  placeMatches: Map<string, PlaceMatch>;
  personal: PiiFinding[];
  /** The sheet row of the first data row (header row + 1). */
  firstFileRow: number;
  /** A sentence that stops the pipeline (a step that cannot run, a limit, columns that disagree); nothing else is returned meaningfully. */
  problem?: string | undefined;
}

/** The header row the steps chose, else the one `applySteps` detects on the chosen sheet. */
const headerRowOf = (steps: readonly TidyStep[], wb: Workbook): number => {
  let row: number | undefined, sheet: string | undefined;
  for (const s of steps) {
    if (s.disabled) continue;
    const c = stepDef(s.type)?.chooses?.(s.params) ?? {};
    if (c.headerRow !== undefined) row = c.headerRow;
    if (c.sheet !== undefined) sheet = c.sheet;
  }
  return row ?? detectHeaderRow((wb.sheets.find((x) => x.name === sheet) ?? wb.sheets[0])?.cells ?? []);
};

/** Columns of an earlier version carried to a new table by source header; new headers are guessed, missing ones dropped and named. */
export function carryColumns(saved: readonly ColumnDef[], table: RawTable): { columns: ColumnDef[]; missing: string[]; added: string[] } {
  const guessed = guessColumns(table).map((p) => p.column);
  const byHeader = new Map(saved.map((c) => [c.sourceHeader, c]));
  const taken = new Set(saved.map((c) => c.key));
  const columns = table.headers.map((h, i) => {
    const old = byHeader.get(h);
    if (old) return old;
    const g = guessed[i]!;
    let key = g.key;
    for (let n = 2; taken.has(key); n += 1) key = `${g.key}_${n}`;
    taken.add(key);
    return { ...g, key };
  });
  return { columns, missing: saved.filter((c) => !table.headers.includes(c.sourceHeader)).map((c) => c.label), added: table.headers.filter((h) => !byHeader.has(h)) };
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const empty = (problem: string, table: RawTable = { headers: [], rows: [] }): PipelineResult => ({ table, columns: [], rows: [], findings: [], placeMatches: new Map(), personal: [], firstFileRow: 2, problem });
  const out = applySteps(input.workbook, input.steps, { extra: input.extra ?? new Map() });
  if (out.problem) return empty(out.problem.message, out.table);
  const table = out.table;
  const limit = limitProblem(table.rows.length, table.headers.length);
  if (limit) return empty(limit, table);
  const firstFileRow = headerRowOf(input.steps, input.workbook) + 1;

  let proposals: ColumnProposal[] | undefined;
  let columns: ColumnDef[];
  if (input.columns?.length) columns = carryColumns(input.columns, table).columns;
  else { proposals = guessColumns(table); columns = proposals.map((p) => p.column); }
  const overrides = kindOverrides(input.steps);
  columns = columns.map((c) => (overrides.has(c.sourceHeader) ? { ...c, kind: overrides.get(c.sourceHeader) as ColumnDef["kind"] } : c));
  const bad = columnProblems(columns);
  if (bad.length) return { ...empty(bad[0]!, table), columns, proposals };

  const samples = table.headers.map((_, i) => table.rows.map((r) => r[i] ?? null).filter((c) => !isBlank(c)).slice(0, 50));
  const personal = detectPersonalData(table.headers, samples);

  const typed = typeRows(table, columns, firstFileRow);
  const placeCols = placeColumnOrder(columns, (c) => columns.indexOf(c));
  const values = new Set<string>();
  for (const c of placeCols) for (const r of typed.rows) { const v = r.values[c.key]; if (typeof v === "string") values.add(v); }
  const placeMatches = input.places ? resolvePlaceValues(values, input.places, input.country) : new Map<string, PlaceMatch>();
  const findings = runChecks({ rows: typed.rows, columns, unreadable: typed.unreadable, ...(input.places ? { places: placeMatches } : {}) }, input.checks ?? []);
  const rows = toStoredRows(typed.rows, columns, placeMatches, placeCols);
  return { table, columns, proposals, rows, findings, placeMatches, personal, firstFileRow };
}

/** The kit's columns and checks applied, for a first upload whose person chose a kit. */
export function withKit(columns: readonly ColumnDef[], kitKey: string | undefined, saved: Record<string, string> = {}): { columns: ColumnDef[]; checks: CheckConfig[]; mapping: Record<string, string> } {
  const kit = kitKey ? kitOf(kitKey) : undefined;
  if (!kit) return { columns: [...columns], checks: [], mapping: {} };
  const m = matchKit(columns, kit, saved);
  return { columns: applyKit(columns, kit, m.mapping), checks: kitChecks(kit, m.mapping), mapping: m.mapping };
}

/** Role → source header, the form a kit mapping is saved in (column keys can change between uploads; headers rarely do). */
export const mappingByHeader = (mapping: Record<string, string>, columns: readonly ColumnDef[]): Record<string, string> =>
  Object.fromEntries(Object.entries(mapping).flatMap(([role, key]) => { const c = columns.find((x) => x.key === key); return c ? [[role, c.sourceHeader]] : []; }));

/** Values that matched no place or several, with their rows, for the "Fix places" screen. */
export function placeIssues(rows: readonly DatasetRowValues[], columns: readonly ColumnDef[], matches: ReadonlyMap<string, PlaceMatch>): Array<{ value: string; status: string; rows: number }> {
  const counts = new Map<string, number>();
  for (const c of columns.filter((x) => semanticOf(x.semantic)?.resolver === "PLACE")) for (const r of rows) { const v = r.values[c.key]; if (typeof v === "string") counts.set(v, (counts.get(v) ?? 0) + 1); }
  return [...counts].flatMap(([value, n]) => { const m = matches.get(value.trim().toLowerCase()); return m && m.status !== "RESOLVED" ? [{ value, status: m.status, rows: n }] : []; }).sort((a, b) => b.rows - a.rows);
}
