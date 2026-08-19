import { INDICATOR_TYPES, type IndicatorType } from "./indicator.js";
import {
  INDICATOR_CODE_HEADERS,
  INDICATOR_NAME_HEADERS,
  INDICATOR_TYPE_HEADERS,
  INDICATOR_BASELINE_HEADERS,
  INDICATOR_TARGET_HEADERS,
  INDICATOR_UNIT_HEADERS,
  INDICATOR_MOV_HEADERS,
  INDICATOR_DATA_SOURCE_HEADERS,
  INDICATOR_FREQUENCY_HEADERS,
  INDICATOR_DISAGG_HEADERS,
  INDICATOR_SHEET_HEADERS,
} from "./header-vocab.js";

export interface ParsedIndicatorRow {
  code: string;
  name: string;
  type: IndicatorType;
  baseline: string;
  target: string;
  unit?: string;
  meansOfVerification?: string;
  dataSource?: string;
  frequency?: string;
  disaggregationRequired: boolean;
}

export interface ParseIndicatorResult {
  rows: ParsedIndicatorRow[];
  warnings: string[];
  /** True when a header row was detected and at least one row was parsed. */
  structured: boolean;
}

const TYPE_SYNONYMS: ReadonlyArray<{ key: string; type: IndicatorType }> = [
  { key: "number", type: "NUMBER" },
  { key: "numeric", type: "NUMBER" },
  { key: "count", type: "NUMBER" },
  { key: "percentage", type: "PERCENTAGE" },
  { key: "percent", type: "PERCENTAGE" },
  { key: "yesno", type: "YES_NO" },
  { key: "yesno_", type: "YES_NO" },
  { key: "boolean", type: "YES_NO" },
  { key: "binary", type: "YES_NO" },
  { key: "text", type: "TEXT" },
  { key: "qualitative", type: "TEXT" },
  { key: "ratio", type: "RATIO" },
  { key: "currency", type: "CURRENCY" },
  { key: "money", type: "CURRENCY" },
  { key: "custom", type: "CUSTOM" },
  { key: "other", type: "CUSTOM" },
];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Splits a delimited line into cells using only the detected delimiter, so
 * text fields may safely contain the other punctuation characters.
 */
function splitDelimited(line: string, delimiter?: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  const splitsOn = delimiter ? (ch: string) => ch === delimiter : (ch: string) => ch === "\t" || ch === "," || ch === ";";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (splitsOn(ch)) {
      if (inQuotes) {
        current += ch;
      } else {
        cells.push(current.trim());
        current = "";
      }
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const normalized = cells.map(normalizeHeader);
  return normalized.filter((h) => h && INDICATOR_SHEET_HEADERS.includes(h)).length >= 2;
}

function normalizeType(value: string): IndicatorType | null {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if ((INDICATOR_TYPES as string[]).includes(trimmed)) return trimmed as IndicatorType;
  const compact = trimmed.replace(/[\s_/-]+/g, "").toLowerCase();
  for (const { key, type } of TYPE_SYNONYMS) {
    if (compact === key || compact === `_${key}`) return type;
  }
  if (trimmed === "%") return "PERCENTAGE";
  return null;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "1" || v === "y";
}

function detectHeaderRow(lines: string[]): { index: number; delimiter: string } | null {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const delimiter = trimmed.includes("\t")
      ? "\t"
      : trimmed.includes(",")
        ? ","
        : trimmed.includes(";")
          ? ";"
          : "";
    if (!delimiter) continue;
    const headers = splitDelimited(trimmed, delimiter).map(normalizeHeader);
    const hasCode = headers.some((h) => INDICATOR_CODE_HEADERS.includes(h));
    const hasName = headers.some((h) => INDICATOR_NAME_HEADERS.includes(h));
    const hasType = headers.some((h) => INDICATOR_TYPE_HEADERS.includes(h));
    if ((hasCode && hasName) || (hasName && hasType) || (hasCode && hasType)) {
      return { index: i, delimiter };
    }
  }
  return null;
}

/**
 * Parses indicator content extracted from an Excel/CSV/plain-text upload into
 * structured rows (Code / Name / Type / Baseline / Target / Unit / ...).
 * Works with the Indicators sheet of the logframe template as well as
 * standalone indicator files. Parsing stops at the first subsequent sheet's
 * header so multi-sheet workbooks never leak rows across sheets.
 */
export function parseIndicatorText(text: string): ParseIndicatorResult {
  const warnings: string[] = [];
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return { rows: [], warnings, structured: false };

  const lines = cleaned.split(/\r?\n/);
  const header = detectHeaderRow(lines);
  if (!header) {
    return {
      rows: [],
      warnings: ["No indicator header row found. Expected columns: Code, Name, Type, Baseline, Target."],
      structured: false,
    };
  }

  const headers = splitDelimited(lines[header.index]?.trim() ?? "", header.delimiter).map(normalizeHeader);
  const codeCol = headers.findIndex((h) => INDICATOR_CODE_HEADERS.includes(h));
  const nameCol = headers.findIndex((h) => INDICATOR_NAME_HEADERS.includes(h));
  const typeCol = headers.findIndex((h) => INDICATOR_TYPE_HEADERS.includes(h));
  const baselineCol = headers.findIndex((h) => INDICATOR_BASELINE_HEADERS.includes(h));
  const targetCol = headers.findIndex((h) => INDICATOR_TARGET_HEADERS.includes(h));
  const unitCol = headers.findIndex((h) => INDICATOR_UNIT_HEADERS.includes(h));
  const movCol = headers.findIndex((h) => INDICATOR_MOV_HEADERS.includes(h));
  const dataSourceCol = headers.findIndex((h) => INDICATOR_DATA_SOURCE_HEADERS.includes(h));
  const frequencyCol = headers.findIndex((h) => INDICATOR_FREQUENCY_HEADERS.includes(h));
  const disaggregationCol = headers.findIndex((h) => INDICATOR_DISAGG_HEADERS.includes(h));

  if (codeCol === -1 && nameCol === -1) {
    return {
      rows: [],
      warnings: ["No Code or Name column found in the header row."],
      structured: false,
    };
  }

  const rows: ParsedIndicatorRow[] = [];
  let pendingSheetMarker = false;
  for (let i = header.index + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      pendingSheetMarker = true;
      continue;
    }
    const cells = splitDelimited(trimmed, header.delimiter);
    if (pendingSheetMarker) {
      if (looksLikeHeaderRow(cells)) break;
      pendingSheetMarker = false;
    }
    if (cells.length === 1 && (cells[0] ?? "") === "") continue;

    const code = codeCol >= 0 ? (cells[codeCol] ?? "").trim() : "";
    const name = nameCol >= 0 ? (cells[nameCol] ?? "").trim() : "";
    if (!code && !name) continue;

    if (!code) {
      warnings.push(`Row ${i + 1}: missing indicator code; skipped.`);
      continue;
    }
    if (!name) {
      warnings.push(`Row ${i + 1} (${code}): missing indicator name; skipped.`);
      continue;
    }

    const rawType = typeCol >= 0 ? (cells[typeCol] ?? "").trim() : "";
    const type = rawType ? normalizeType(rawType) : null;
    if (!type) {
      warnings.push(`Row ${i + 1} (${code}): could not determine an indicator type from "${rawType}"; skipped.`);
      continue;
    }

    rows.push({
      code,
      name,
      type,
      baseline: baselineCol >= 0 ? (cells[baselineCol] ?? "").trim() : "",
      target: targetCol >= 0 ? (cells[targetCol] ?? "").trim() : "",
      unit: unitCol >= 0 ? (cells[unitCol] ?? "").trim() || undefined : undefined,
      meansOfVerification: movCol >= 0 ? (cells[movCol] ?? "").trim() || undefined : undefined,
      dataSource: dataSourceCol >= 0 ? (cells[dataSourceCol] ?? "").trim() || undefined : undefined,
      frequency: frequencyCol >= 0 ? (cells[frequencyCol] ?? "").trim() || undefined : undefined,
      disaggregationRequired: disaggregationCol >= 0 ? parseBoolean(cells[disaggregationCol]) : false,
    });
  }

  return { rows, warnings, structured: rows.length > 0 };
}
