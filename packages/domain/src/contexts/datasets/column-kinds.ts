import type { FieldType } from "../visual-data/types.js";
import type { CellValue } from "./model.js";
import { readDay, readMonth, readNumber, readText, readWeek, readYesNo } from "./parse-cells.js";

/**
 * What a column holds (§3.1). Each row declares its role (something to group by, or a figure), whether its figures may be added
 * across rows, the catalogue type it becomes and how a cell is read. Nothing branches on a kind's name: behaviour comes from the row.
 * `parse` answers null for an empty cell and undefined for a cell that cannot be read.
 */
export interface ColumnKind {
  key: string;
  label: string;
  role: "GROUP" | "FIGURE";
  additive: boolean;
  money: boolean;
  fieldType: FieldType;
  parse(cell: CellValue | undefined): CellValue | undefined;
  /** One sentence the confirm screen shows beside the chip. */
  meaning: string;
  /** What one value is called, and how to write one, for a problem sentence ("not a month (write it like May 2026)"). */
  noun: string;
  example: string;
}

const rows = [
  { key: "TEXT", label: "Text", role: "GROUP", additive: false, money: false, fieldType: "TEXT", parse: readText, meaning: "Words to group or filter by.", noun: "a word", example: "Kabul" },
  { key: "COUNT", label: "Count", role: "FIGURE", additive: true, money: false, fieldType: "COUNT", parse: readNumber, meaning: "A number that can be added up across rows (people, sessions, items).", noun: "a number", example: "1250" },
  { key: "NUMBER", label: "Number (not added)", role: "FIGURE", additive: false, money: false, fieldType: "COUNT", parse: readNumber, meaning: "A number that must not be added across rows (a score, a stock level on a day).", noun: "a number", example: "12.5" },
  { key: "AMOUNT", label: "Amount of money", role: "FIGURE", additive: true, money: true, fieldType: "AMOUNT", parse: readNumber, meaning: "Money: added up only within one currency.", noun: "an amount", example: "1250.50" },
  { key: "RATE", label: "Rate or percentage", role: "FIGURE", additive: false, money: false, fieldType: "RATE", parse: readNumber, meaning: "A rate: never added or averaged across rows, only recomputed from its parts.", noun: "a rate", example: "76.4" },
  { key: "DATE", label: "Day", role: "GROUP", additive: false, money: false, fieldType: "DATE", parse: readDay, meaning: "A calendar day.", noun: "a day", example: "2026-05-31" },
  { key: "MONTH", label: "Month", role: "GROUP", additive: false, money: false, fieldType: "DATE", parse: readMonth, meaning: "A calendar month.", noun: "a month", example: "May 2026 or 2026-05" },
  { key: "WEEK", label: "Epidemiological week", role: "GROUP", additive: false, money: false, fieldType: "DATE", parse: readWeek, meaning: "An epidemiological week (year and week number).", noun: "a week", example: "2026-W07" },
  { key: "YES_NO", label: "Yes or no", role: "GROUP", additive: false, money: false, fieldType: "FLAG", parse: readYesNo, meaning: "Yes or no.", noun: "yes or no", example: "Yes" },
] as const satisfies readonly ColumnKind[];

export type ColumnKindKey = (typeof rows)[number]["key"];
export const COLUMN_KINDS: readonly ColumnKind[] = rows;
export const COLUMN_KIND_KEYS = rows.map((r) => r.key) as readonly ColumnKindKey[];
const BY_KEY = new Map<string, ColumnKind>(rows.map((r) => [r.key, r]));
export const columnKind = (key: string): ColumnKind | undefined => BY_KEY.get(key);
export const isColumnKind = (key: string): key is ColumnKindKey => BY_KEY.has(key);
