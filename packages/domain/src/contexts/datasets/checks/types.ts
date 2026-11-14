import type { ColumnDef } from "../model.js";
import { columnKind } from "../column-kinds.js";
import type { TypedRow, UnreadableCell } from "../typed-rows.js";

export const CHECK_SEVERITIES = ["BLOCK", "WARN", "NOTE"] as const;
export type CheckSeverity = (typeof CHECK_SEVERITIES)[number];

export interface Finding {
  check: string;
  severity: CheckSeverity;
  /** Sheet row numbers the finding is about (the problems sheet marks every one). */
  rows: number[];
  message: string;
  column?: string | undefined;
}

/** What a check sees: the typed rows, the columns, the unreadable cells and how each place value was resolved. */
export interface CheckInput {
  rows: readonly TypedRow[];
  columns: readonly ColumnDef[];
  unreadable: readonly UnreadableCell[];
  /** Place text → resolution (RESOLVED with a place id, AMBIGUOUS, UNRESOLVED). Absent when the dataset has no place column. */
  places?: ReadonlyMap<string, { status: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED"; placeId?: string | undefined }> | undefined;
}

export interface CheckParamDef { key: string; label: string; type: "COLUMN" | "COLUMNS" | "NUMBER" }

/** A configured check: a row of the registry plus its params. A kit ships its own with labelled params (§3.5). */
export interface CheckConfig { id: string; check: string; severity?: CheckSeverity | undefined; params: Record<string, unknown>; label?: string | undefined }

export interface CheckDef {
  key: string;
  label: string;
  defaultSeverity: CheckSeverity;
  params: readonly CheckParamDef[];
  /** Always run on every dataset (key, place, period); others run only when configured. */
  always: boolean;
  /** A sentence when the params do not fit the columns. */
  validate(params: Record<string, unknown>, columns: readonly ColumnDef[]): string | undefined;
  run(input: CheckInput, params: Record<string, unknown>): Array<Omit<Finding, "check" | "severity">>;
}

export const colOf = (columns: readonly ColumnDef[], key: unknown): ColumnDef | undefined => (typeof key === "string" ? columns.find((c) => c.key === key) : undefined);
export const keysOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
export const numOf = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
export const fig = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const fmt = (n: number): string => (Number.isInteger(n) ? n.toLocaleString("en") : n.toLocaleString("en", { maximumFractionDigits: 2 }));
export const needColumns = (columns: readonly ColumnDef[], keys: readonly string[], figures = true): string | undefined => {
  for (const k of keys) {
    const c = colOf(columns, k);
    if (!c) return "Choose the columns this check compares.";
    if (figures && columnKind(c.kind)?.role !== "FIGURE") return `${c.label} is not a figure.`;
  }
  return undefined;
};
