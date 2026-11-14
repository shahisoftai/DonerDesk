import { isBlank } from "../parse-cells.js";
import type { CellValue, RawTable } from "../model.js";
import { stepDef } from "./registry.js";
import type { StepContext, TidyStep, Workbook } from "./types.js";

export interface StepOutcome { table: RawTable; applied: number; problem?: { stepId: string; index: number; message: string } | undefined }

const MAX_HEADER_SCAN = 15;

/**
 * Which row holds the headers: the first of the top rows where most cells are filled and most are words, not numbers ("Headers look
 * like row 3"). 1-based. A sheet whose first row already looks like headers answers 1.
 */
export function detectHeaderRow(cells: readonly CellValue[][]): number {
  const width = Math.max(0, ...cells.slice(0, MAX_HEADER_SCAN + 5).map((r) => r.filter((c) => !isBlank(c)).length));
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN, cells.length); i += 1) {
    const filled = cells[i]!.filter((c) => !isBlank(c));
    const words = filled.filter((c) => typeof c === "string" && !/^-?[\d.,\s%]+$/.test(c));
    if (width > 0 && filled.length >= Math.max(2, Math.ceil(width * 0.6)) && words.length >= filled.length * 0.8) return i + 1;
  }
  return 1;
}

/** The table on a sheet with headers on a row. Blank headers become "Column N"; repeated ones get " (2)"; fully empty rows are dropped. */
export function tableFromWorkbook(wb: Workbook, sheet?: string, headerRow?: number): RawTable | undefined {
  const grid = (sheet ? wb.sheets.find((s) => s.name === sheet) : undefined) ?? wb.sheets[0];
  if (!grid) return undefined;
  const at = (headerRow ?? detectHeaderRow(grid.cells)) - 1;
  const raw = grid.cells[at] ?? [];
  const width = Math.max(raw.length, ...grid.cells.slice(at + 1).map((r) => r.length));
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, i) => {
    const base = isBlank(raw[i]) ? `Column ${i + 1}` : String(raw[i]).trim().replace(/\s+/g, " ");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
  const rows = grid.cells.slice(at + 1).filter((r) => r.some((c) => !isBlank(c))).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
  // A trailing column with no header and no values is dropped (spreadsheets often report a wider range than is used).
  let keep = width;
  while (keep > 0 && /^Column \d+$/.test(headers[keep - 1]!) && rows.every((r) => isBlank(r[keep - 1]))) keep -= 1;
  return { headers: headers.slice(0, keep), rows: rows.map((r) => r.slice(0, keep)) };
}

/**
 * Replays the recorded steps on a workbook (§3.4): SOURCE steps pick the sheet and header row, then TABLE steps run in order. The
 * first step that cannot run stops the replay and is named, so a refresh never half-applies a list. Pure and idempotent.
 */
export function applySteps(wb: Workbook, steps: readonly TidyStep[], ctx: StepContext = { extra: new Map() }): StepOutcome {
  let sheet: string | undefined, headerRow: number | undefined, sheetStep = -1;
  steps.forEach((s, i) => {
    if (s.disabled) return;
    const choice = stepDef(s.type)?.chooses?.(s.params) ?? {};
    if (choice.sheet !== undefined) { sheet = choice.sheet; sheetStep = i; }
    if (choice.headerRow !== undefined) headerRow = choice.headerRow;
  });
  let table = tableFromWorkbook(wb, sheet, headerRow) ?? { headers: [], rows: [] };
  if (sheet && !wb.sheets.some((s) => s.name === sheet)) {
    return { table, applied: 0, problem: { stepId: steps[sheetStep]!.id, index: sheetStep, message: `The file has no sheet called '${sheet}'.` } };
  }
  let applied = 0;
  for (const [index, step] of steps.entries()) {
    if (step.disabled) continue;
    const def = stepDef(step.type);
    if (!def) return { table, applied, problem: { stepId: step.id, index, message: "This step is not known any more; remove it." } };
    if (def.phase === "SOURCE") { applied += 1; continue; }
    const bad = def.validate(step.params, table.headers);
    if (bad) return { table, applied, problem: { stepId: step.id, index, message: `${def.describe(step.params)}: ${bad}` } };
    const r = def.apply(table, step.params, ctx);
    if (!r.ok) return { table, applied, problem: { stepId: step.id, index, message: r.problem } };
    table = r.table;
    applied += 1;
  }
  return { table, applied };
}

/** The kind each RETYPE step sets, by header after all steps (the last one wins). */
export function kindOverrides(steps: readonly TidyStep[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of steps) {
    const pair = s.disabled ? undefined : stepDef(s.type)?.kindOverride?.(s.params);
    if (pair) out.set(pair[0], pair[1]);
  }
  return out;
}

/** The step list as sentences, for the Tidy screen and the version history. */
export const describeSteps = (steps: readonly TidyStep[]): string[] => steps.map((s) => `${stepDef(s.type)?.describe(s.params) ?? s.type}${s.disabled ? " (switched off)" : ""}`);
