import type { StepDef } from "./types.js";
import { str } from "./types.js";

/**
 * Choosing the table inside a file. These two are applied by `tableFromWorkbook` before the table steps, but they are ordinary rows
 * of the registry so the step list shows them as sentences and a refresh replays them.
 */
export const USE_SHEET: StepDef = {
  type: "USE_SHEET", label: "Use a sheet", phase: "SOURCE",
  validate: (p) => (str(p.sheet).trim() ? undefined : "Choose a sheet."),
  apply: (table) => ({ ok: true, table }),
  describe: (p) => `Use sheet '${str(p.sheet)}'`,
  chooses: (p) => (str(p.sheet) ? { sheet: str(p.sheet) } : {}),
};

export const HEADER_ROW: StepDef = {
  type: "HEADER_ROW", label: "Headers on a row", phase: "SOURCE",
  validate: (p) => (Number.isInteger(p.row) && (p.row as number) >= 1 && (p.row as number) <= 50 ? undefined : "The header row is between 1 and 50."),
  apply: (table) => ({ ok: true, table }),
  describe: (p) => `Headers on row ${String(p.row)}`,
  chooses: (p) => (Number.isInteger(p.row) ? { headerRow: p.row as number } : {}),
};
