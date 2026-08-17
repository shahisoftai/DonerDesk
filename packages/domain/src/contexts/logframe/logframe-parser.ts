import type { LogframeLevel } from "./logframe-item.js";

export interface ParsedLogframeRow {
  level: LogframeLevel;
  code?: string;
  title: string;
  description?: string;
}

export interface ParseLogframeResult {
  rows: ParsedLogframeRow[];
  warnings: string[];
  /** True when at least one row carried an explicit level keyword, code, indentation, or header mapping. */
  structured: boolean;
}

const LEVEL_RANK: Record<LogframeLevel, number> = {
  GOAL: 0,
  OUTCOME: 1,
  OUTPUT: 2,
  ACTIVITY: 3,
};

const LEVEL_WORDS: ReadonlyArray<{ word: string; level: LogframeLevel }> = [
  { word: "goal", level: "GOAL" },
  { word: "impact", level: "GOAL" },
  { word: "outcome", level: "OUTCOME" },
  { word: "output", level: "OUTPUT" },
  { word: "activity", level: "ACTIVITY" },
];

const LEVEL_HEADERS: ReadonlyArray<string> = ["level", "resultlevel", "logframelevel", "hierarchy", "levelofresult"];
const CODE_HEADERS: ReadonlyArray<string> = ["code", "itemcode", "resultcode", "lfcode", "logframecode"];
const TITLE_HEADERS: ReadonlyArray<string> = ["title", "result", "resultstatement", "statement", "item", "name", "intervention"];
const DESC_HEADERS: ReadonlyArray<string> = ["description", "desc", "definition", "detail", "descriptionofresult"];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitDelimited(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\t" || ch === "," || ch === ";") {
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

function inferLevelFromCode(code: string): LogframeLevel | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const dotted = /^(\d+)(?:\.(\d+))*$/.exec(trimmed);
  if (dotted) {
    const depth = trimmed.split(".").length;
    return depth >= 4 ? "ACTIVITY" : depth === 3 ? "OUTPUT" : depth === 2 ? "OUTCOME" : "GOAL";
  }

  const upper = trimmed.toUpperCase();
  const letterPrefix = /^([A-Z]+)\d/.exec(upper);
  const prefix = letterPrefix?.[1] ?? "";
  if (/^GOAL/.test(prefix) || prefix === "G" || prefix === "IMP" || prefix === "I") return "GOAL";
  if (/^OUTCOME/.test(prefix) || prefix === "OC" || prefix === "O") return "OUTCOME";
  if (/^OUTPUT/.test(prefix) || prefix === "OP" || prefix === "OUT") return "OUTPUT";
  if (/^ACT/.test(prefix) || prefix === "A") return "ACTIVITY";

  for (const { word, level } of LEVEL_WORDS) {
    if (upper.startsWith(word.toUpperCase())) return level;
  }
  return null;
}

function parseLevelValue(value: string): LogframeLevel | null {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n >= 4 ? "ACTIVITY" : n === 3 ? "OUTPUT" : n === 2 ? "OUTCOME" : n === 1 ? "GOAL" : null;
  }
  const inferred = inferLevelFromCode(trimmed);
  if (inferred) return inferred;
  for (const { word, level } of LEVEL_WORDS) {
    if (trimmed.startsWith(word.toUpperCase())) return level;
  }
  return null;
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
    const headers = splitDelimited(trimmed).map(normalizeHeader);
    const hasLevel = headers.some((h) => LEVEL_HEADERS.includes(h));
    const hasCode = headers.some((h) => CODE_HEADERS.includes(h));
    const hasTitle = headers.some((h) => TITLE_HEADERS.includes(h));
    if (hasTitle || (hasLevel && hasCode)) {
      return { index: i, delimiter };
    }
  }
  return null;
}

function parseTabular(text: string): { rows: ParsedLogframeRow[]; warnings: string[]; structured: boolean } {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);
  const header = detectHeaderRow(lines);
  if (!header) return { rows: [], warnings, structured: false };

  const headers = splitDelimited(lines[header.index]?.trim() ?? "").map(normalizeHeader);
  const levelCol = headers.findIndex((h) => LEVEL_HEADERS.includes(h));
  const codeCol = headers.findIndex((h) => CODE_HEADERS.includes(h));
  const titleCol = headers.findIndex((h) => TITLE_HEADERS.includes(h));
  const descCol = headers.findIndex((h) => DESC_HEADERS.includes(h));

  if (titleCol === -1 && codeCol === -1) {
    return { rows: [], warnings: ["No Title or Code column found in the header row."], structured: false };
  }

  const rows: ParsedLogframeRow[] = [];
  for (let i = header.index + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cells = splitDelimited(trimmed);
    if (cells.length === 1 && (cells[0] ?? "") === "") continue;

    const title = titleCol >= 0 ? (cells[titleCol] ?? "").trim() : "";
    const code = codeCol >= 0 ? (cells[codeCol] ?? "").trim() : "";
    const rawLevel = levelCol >= 0 ? (cells[levelCol] ?? "").trim() : "";

    if (!title && !code) continue;

    let level: LogframeLevel | null = rawLevel ? parseLevelValue(rawLevel) : null;
    if (!level && code) level = inferLevelFromCode(code);
    if (!level) {
      warnings.push(`Line ${i + 1}: could not determine a level${code ? ` for code "${code}"` : ""}; skipped.`);
      continue;
    }

    if (!title) {
      warnings.push(`Line ${i + 1}${code ? ` (${code})` : ""}: missing a title; skipped.`);
      continue;
    }

    rows.push({
      level,
      code: code || undefined,
      title,
      description: descCol >= 0 ? (cells[descCol] ?? "").trim() || undefined : undefined,
    });
  }
  return { rows, warnings, structured: rows.length > 0 };
}

function leadingDepth(line: string): number {
  const match = /^([ \t]*)/.exec(line);
  if (!match) return 0;
  const raw = match[1] ?? "";
  let depth = 0;
  for (const ch of raw) depth += ch === "\t" ? 1 : 0.25;
  return depth;
}

function parseLineBased(text: string): { rows: ParsedLogframeRow[]; warnings: string[]; structured: boolean } {
  const warnings: string[] = [];
  const rows: ParsedLogframeRow[] = [];
  const lines = text.split(/\r?\n/);
  let structured = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const depth = leadingDepth(raw);

    let levelMatch: RegExpExecArray | null = /^(GOAL|IMPACT|OUTCOME|OUTPUT|ACTIVITY)\b[:\-.\s]*/i.exec(line);
    let level: LogframeLevel | null = null;
    let rest = line;
    if (levelMatch) {
      const word = (levelMatch[1] ?? "").toLowerCase();
      level = word === "impact" ? "GOAL" : (word.toUpperCase() as LogframeLevel);
      rest = line.slice(levelMatch[0].length).trim();
      structured = true;
    }

    // Headerless tabular line such as "GOAL,G1,Clean water" — split on the
    // first comma to recover code and title.
    if (level && rest.startsWith(",")) {
      const cells = splitDelimited(rest.slice(1));
      const code = (cells[0] ?? "").trim();
      const title = (cells[1] ?? "").trim();
      if (title) {
        rows.push({
          level,
          code: code || undefined,
          title,
          description: (cells[2] ?? "").trim() || undefined,
        });
        continue;
      }
    }

    const codeMatch = /^([A-Za-z]?\d+(?:\.\d+)*)\s*(?:[:\-–—,;)\]\s]\s*)?(.*)$/.exec(rest);
    let code: string | undefined;
    if (codeMatch && !level) {
      const candidate = codeMatch[1] ?? "";
      const inferred = inferLevelFromCode(candidate);
      if (inferred && (codeMatch[2] ?? "")) {
        code = candidate;
        rest = (codeMatch[2] ?? "").trim();
        level = inferred;
        structured = true;
      }
    } else if (codeMatch) {
      const candidate = codeMatch[1] ?? "";
      const isDotted = candidate.includes(".");
      const isLetterCode = /^[A-Za-z]\d/.test(candidate);
      const nextChar = rest.slice(candidate.length, candidate.length + 1);
      const followedBySeparator = Boolean(nextChar && /[,:;–—()|]/.test(nextChar));
      if (isDotted || isLetterCode || followedBySeparator) {
        code = candidate;
        rest = (codeMatch[2] ?? "").trim();
        structured = true;
      }
    }

    if (!level) {
      level = depth >= 3 ? "ACTIVITY" : depth >= 2 ? "OUTPUT" : depth >= 1 ? "OUTCOME" : "GOAL";
      if (depth > 0) structured = true;
    }

    if (!rest || rest.length < 2) {
      warnings.push(`Line ${i + 1}: missing a title; skipped.`);
      continue;
    }

    let title = rest;
    let description: string | undefined;
    const descSplit = /^(.*?)\s*(?:—|–|-{2,}|\|)\s*(.+)$/.exec(rest);
    if (descSplit && (descSplit[1] ?? "").trim().length > 2) {
      title = (descSplit[1] ?? "").trim();
      description = (descSplit[2] ?? "").trim();
    }

    rows.push({ level, code, title, description });
  }
  return { rows, warnings, structured };
}

/**
 * Parses logframe content extracted from an Excel/CSV/plain-text upload into
 * structured rows (Level / Code / Title / Description). Tabular inputs with a
 * recognized header row are mapped by column; otherwise lines are parsed using
 * explicit level keywords, dotted codes, or indentation to infer the level.
 */
export function parseLogframeText(text: string): ParseLogframeResult {
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return { rows: [], warnings: [], structured: false };

  const tabular = parseTabular(cleaned);
  if (tabular.rows.length > 0) return tabular;

  return parseLineBased(cleaned);
}

export function levelRank(level: LogframeLevel): number {
  return LEVEL_RANK[level];
}
