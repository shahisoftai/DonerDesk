import type { CellValue, RawTable } from "../model.js";

/** A workbook as read from a file: sheets of cells, nothing interpreted. A CSV is one sheet. */
export interface SheetGrid { name: string; cells: CellValue[][] }
export interface Workbook { sheets: SheetGrid[] }

/** One recorded tidy step (§3.4). Params are plain data so the list is stored on the version and replayed on every refresh. */
export interface TidyStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  /** A step switched off stays in the list (and can be switched on again) but does nothing. */
  disabled?: boolean | undefined;
}

export interface StepContext {
  /** Other files the APPEND step reads, by the key they were uploaded under. */
  extra: ReadonlyMap<string, RawTable>;
}

export type StepResult = { ok: true; table: RawTable } | { ok: false; problem: string };

export interface StepDef {
  type: string;
  label: string;
  /** SOURCE steps choose what becomes the table (sheet, header row); TABLE steps change the table. */
  phase: "SOURCE" | "TABLE";
  /** A sentence when the params cannot work with these headers; undefined when they can. */
  validate(params: Record<string, unknown>, headers: readonly string[]): string | undefined;
  apply(table: RawTable, params: Record<string, unknown>, ctx: StepContext): StepResult;
  /** The step as a sentence ("Fill 'Province' down"). */
  describe(params: Record<string, unknown>): string;
  /** A SOURCE step's choice of sheet or header row. */
  chooses?(params: Record<string, unknown>): { sheet?: string; headerRow?: number };
  /** A step that sets what a column holds, applied when columns are confirmed: [header, column kind]. */
  kindOverride?(params: Record<string, unknown>): [string, string] | undefined;
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const colIndex = (table: RawTable, header: string): number => table.headers.indexOf(header);
export const missing = (headers: readonly string[], names: readonly string[]): string | undefined => {
  const gone = names.filter((n) => !headers.includes(n));
  return gone.length ? `There is no column called ${gone.map((g) => `'${g}'`).join(", ")}.` : undefined;
};
