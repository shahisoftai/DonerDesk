import { DEFAULT_VOCABULARY, documentName, levelName, type FrameworkVocabulary } from "./framework-vocabulary.js";
import { logframeLevelRank, type LogframeLevel } from "./logframe-item.js";
import type { LogframeSnapshot, SnapshotIndicator, SnapshotItem } from "./logframe-snapshot.js";

/**
 * One backbone, two ways to read it. The Results Framework lens shows the chain of results and why each leads to the next;
 * the Logframe lens shows the measurement matrix. Both read the same items and indicators; a lens only chooses which levels
 * and which fields are shown.
 */
export type FrameworkLensKey = "RESULTS" | "LOGFRAME";

export type ResultField = "title" | "description" | "rationale" | "assumptions";
export type IndicatorField = "code" | "name" | "baseline" | "target" | "unit" | "meansOfVerification" | "dataSource" | "frequency";

export interface FrameworkLens {
  key: FrameworkLensKey;
  /** Levels shown; a result at another level, and its indicators, are left out. */
  levels: ReadonlyArray<LogframeLevel>;
  resultFields: ReadonlyArray<ResultField>;
  indicatorFields: ReadonlyArray<IndicatorField>;
}

/** A new lens is a row here and nothing else. */
export const FRAMEWORK_LENSES: Readonly<Record<FrameworkLensKey, FrameworkLens>> = {
  RESULTS: {
    key: "RESULTS",
    levels: ["GOAL", "OUTCOME", "OUTPUT"],
    resultFields: ["title", "description", "rationale"],
    indicatorFields: ["code", "name"],
  },
  LOGFRAME: {
    key: "LOGFRAME",
    levels: ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"],
    resultFields: ["title", "assumptions"],
    indicatorFields: ["code", "name", "baseline", "target", "unit", "meansOfVerification", "dataSource", "frequency"],
  },
};

export const FRAMEWORK_LENS_KEYS = Object.keys(FRAMEWORK_LENSES) as FrameworkLensKey[];

export function isFrameworkLens(value: string): value is FrameworkLensKey {
  return Object.prototype.hasOwnProperty.call(FRAMEWORK_LENSES, value);
}

/** The words above each column, in one table so the screen and every file agree. */
export const COLUMN_LABELS: Readonly<Record<ResultField | IndicatorField | "level" | "resultCode", string>> = {
  level: "Level",
  resultCode: "Code",
  title: "Result",
  description: "Description",
  rationale: "Why this leads to the result above",
  assumptions: "Assumptions",
  code: "Indicator code",
  name: "Indicator",
  baseline: "Baseline",
  target: "Target",
  unit: "Unit",
  meansOfVerification: "Means of verification",
  dataSource: "Data source",
  frequency: "How often",
};

export interface FrameworkColumn {
  key: string;
  label: string;
  /** Which kind of row this column describes; on the other kind its cell is empty by design, not a gap. */
  owner: "RESULT" | "INDICATOR";
}

/** Level and code first, then the result's own fields, then the indicator's. A field two groups share is named once. */
export function frameworkColumns(lens: FrameworkLens): FrameworkColumn[] {
  const columns: FrameworkColumn[] = [{ key: "level", label: COLUMN_LABELS.level, owner: "RESULT" }, { key: "resultCode", label: COLUMN_LABELS.resultCode, owner: "RESULT" }];
  for (const key of lens.resultFields) columns.push({ key, label: COLUMN_LABELS[key], owner: "RESULT" });
  for (const key of lens.indicatorFields) columns.push({ key, label: COLUMN_LABELS[key], owner: "INDICATOR" });
  return columns;
}

export interface FrameworkRow {
  kind: "RESULT" | "INDICATOR";
  /** The result's depth in the chain (an indicator sits one step under its result). */
  depth: number;
  /** The cell for each column key; null is a value nobody recorded, never 0. */
  cells: Record<string, string | null>;
}

export interface FrameworkDocument {
  lens: FrameworkLensKey;
  /** What the donor calls this document ("Logframe", "Results Framework"). */
  title: string;
  columns: FrameworkColumn[];
  rows: FrameworkRow[];
}

const clean = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text === "" ? null : text;
};

/** The framework as the lens reads it. Pure: the same snapshot, lens and words give the same document. */
export function renderFramework(snapshot: LogframeSnapshot, lens: FrameworkLens, vocabulary: FrameworkVocabulary = DEFAULT_VOCABULARY): FrameworkDocument {
  const kept = snapshot.items.filter((item) => lens.levels.includes(item.level as LogframeLevel));
  const keptIds = new Set(kept.map((item) => item.id));
  const children = new Map<string | null, SnapshotItem[]>();
  for (const item of kept) {
    // A result whose parent is not shown becomes a root rather than being lost.
    const parent = item.parentId && keptIds.has(item.parentId) ? item.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }
  // Siblings read in the tree's own order (as `compareLogframeItems`: position, level, then code numerically). The snapshot is
  // ordered by position then id for a stable hash, which would put OC2 before OC1 when nothing was ever reordered.
  const treeOrder = (a: SnapshotItem, b: SnapshotItem) =>
    a.sortOrder - b.sortOrder ||
    logframeLevelRank(a.level as LogframeLevel) - logframeLevelRank(b.level as LogframeLevel) ||
    (a.code ?? "").localeCompare(b.code ?? "", undefined, { numeric: true });
  for (const list of children.values()) list.sort(treeOrder);
  const indicatorsOf = new Map<string, SnapshotIndicator[]>();
  for (const indicator of snapshot.indicators) {
    if (indicator.archived || !keptIds.has(indicator.logframeItemId)) continue;
    indicatorsOf.set(indicator.logframeItemId, [...(indicatorsOf.get(indicator.logframeItemId) ?? []), indicator]);
  }
  for (const list of indicatorsOf.values()) list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const columns = frameworkColumns(lens);
  // Every row has a cell for every column, so a screen or a file never meets a missing key.
  const blank = (): Record<string, string | null> => Object.fromEntries(columns.map((c) => [c.key, null]));
  const rows: FrameworkRow[] = [];
  const visit = (item: SnapshotItem, depth: number) => {
    const cells: Record<string, string | null> = { ...blank(), level: levelName(item.level as LogframeLevel, vocabulary), resultCode: clean(item.code) };
    for (const field of lens.resultFields) cells[field] = clean(item[field]);
    rows.push({ kind: "RESULT", depth, cells });
    for (const indicator of indicatorsOf.get(item.id) ?? []) {
      const own = blank();
      for (const field of lens.indicatorFields) own[field] = clean(indicator[field]);
      rows.push({ kind: "INDICATOR", depth: depth + 1, cells: own });
    }
    for (const child of children.get(item.id) ?? []) visit(child, depth + 1);
  };
  for (const root of children.get(null) ?? []) visit(root, 0);

  return { lens: lens.key, title: documentName(vocabulary), columns, rows };
}

/** A problem with a lens definition; the contract test requires none for every lens. */
export function lensProblems(lens: FrameworkLens): string[] {
  const problems: string[] = [];
  if (lens.levels.length === 0) problems.push("shows no levels");
  if (lens.resultFields.length === 0) problems.push("shows no result field");
  if (!lens.resultFields.includes("title")) problems.push("does not show the result's title");
  if (new Set(lens.levels).size !== lens.levels.length) problems.push("repeats a level");
  return problems;
}
