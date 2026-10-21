/**
 * The results framework as it stood at one moment, and what changed between two moments. Editing a target used to
 * overwrite the row, so nothing could show what the framework said when a report was approved or why a figure moved.
 * A snapshot is pure data (built from the items and indicators the caller reads), serialised in one canonical form so two
 * snapshots of the same framework are byte-identical and a no-op save writes no new version.
 */
export interface SnapshotItem {
  id: string;
  parentId: string | null;
  level: string;
  code: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface SnapshotIndicator {
  id: string;
  logframeItemId: string;
  code: string;
  name: string;
  type: string;
  baseline: string;
  target: string;
  unit: string | null;
  meansOfVerification: string | null;
  dataSource: string | null;
  frequency: string | null;
  disaggregationRequired: boolean;
  archived: boolean;
  semantics: unknown;
  targetBreakdowns: unknown;
  /** Present only when a schedule is set, so a framework without one keeps the same content hash as before. */
  targetSchedule?: unknown;
}

export interface LogframeSnapshot {
  items: SnapshotItem[];
  indicators: SnapshotIndicator[];
}

interface ItemLike {
  id: string;
  parentId?: string | undefined;
  level: string;
  code?: string | undefined;
  title: string;
  description?: string | undefined;
  sortOrder: number;
}

interface IndicatorLike {
  id: string;
  logframeItemId: string;
  code: string;
  name: string;
  type: string;
  baseline: string;
  target: string;
  unit?: string | undefined;
  meansOfVerification?: string | undefined;
  dataSource?: string | undefined;
  frequency?: string | undefined;
  disaggregationRequired: boolean;
  isArchived: boolean;
  semantics?: unknown;
  targetBreakdowns: unknown;
  targetSchedule?: ReadonlyArray<unknown>;
}

export function buildLogframeSnapshot(items: ReadonlyArray<ItemLike>, indicators: ReadonlyArray<IndicatorLike>): LogframeSnapshot {
  return {
    items: items
      .map((i) => ({
        id: i.id,
        parentId: i.parentId ?? null,
        level: i.level,
        code: i.code ?? null,
        title: i.title,
        description: i.description ?? null,
        sortOrder: i.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    indicators: indicators
      .map((i) => ({
        id: i.id,
        logframeItemId: i.logframeItemId,
        code: i.code,
        name: i.name,
        type: i.type,
        baseline: i.baseline,
        target: i.target,
        unit: i.unit ?? null,
        meansOfVerification: i.meansOfVerification ?? null,
        dataSource: i.dataSource ?? null,
        frequency: i.frequency ?? null,
        disaggregationRequired: i.disaggregationRequired,
        archived: i.isArchived,
        semantics: i.semantics ?? null,
        targetBreakdowns: i.targetBreakdowns ?? [],
        ...(i.targetSchedule?.length ? { targetSchedule: i.targetSchedule } : {}),
      }))
      .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id)),
  };
}

/** One canonical JSON text per snapshot (fixed key order), so equal frameworks give equal text and equal hashes. */
export function canonicalSnapshotJson(snapshot: LogframeSnapshot): string {
  return JSON.stringify({ items: snapshot.items, indicators: snapshot.indicators });
}

export function parseSnapshot(json: string): LogframeSnapshot | null {
  try {
    const raw = JSON.parse(json) as Partial<LogframeSnapshot>;
    return Array.isArray(raw.items) && Array.isArray(raw.indicators) ? { items: raw.items, indicators: raw.indicators } : null;
  } catch {
    return null;
  }
}

export type LogframeChangeKind = "ITEM_ADDED" | "ITEM_REMOVED" | "ITEM_CHANGED" | "INDICATOR_ADDED" | "INDICATOR_REMOVED" | "INDICATOR_CHANGED";

export interface LogframeChange {
  kind: LogframeChangeKind;
  /** The code (or title) a person knows it by. */
  label: string;
  /** For a change: which field, and its value before and after. */
  field?: string;
  from?: string;
  to?: string;
}

const ITEM_FIELDS: ReadonlyArray<[keyof SnapshotItem, string]> = [
  ["title", "title"],
  ["description", "description"],
  ["code", "code"],
  ["parentId", "place in the framework"],
  ["level", "level"],
];

const INDICATOR_FIELDS: ReadonlyArray<[keyof SnapshotIndicator, string]> = [
  ["name", "name"],
  ["baseline", "baseline"],
  ["target", "target"],
  ["unit", "unit"],
  ["type", "type"],
  ["frequency", "frequency"],
  ["dataSource", "data source"],
  ["meansOfVerification", "means of verification"],
  ["disaggregationRequired", "breakdown required"],
  ["semantics", "how it is read"],
  ["targetBreakdowns", "targets by group"],
  ["targetSchedule", "target schedule"],
  ["logframeItemId", "output it belongs to"],
  ["archived", "retired"],
];

const show = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "(none)" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** What changed from `before` to `after` (before = null means the framework did not exist yet). Reordering alone is not a change. */
export function diffLogframeSnapshots(before: LogframeSnapshot | null, after: LogframeSnapshot): LogframeChange[] {
  const changes: LogframeChange[] = [];
  const oldItems = new Map((before?.items ?? []).map((i) => [i.id, i]));
  const oldIndicators = new Map((before?.indicators ?? []).map((i) => [i.id, i]));
  const label = (i: { code: string | null; title: string }) => i.code ?? i.title;

  for (const item of after.items) {
    const was = oldItems.get(item.id);
    if (!was) {
      changes.push({ kind: "ITEM_ADDED", label: label(item) });
      continue;
    }
    for (const [key, name] of ITEM_FIELDS) {
      if (JSON.stringify(was[key]) !== JSON.stringify(item[key])) {
        changes.push({ kind: "ITEM_CHANGED", label: label(item), field: name, from: show(was[key]), to: show(item[key]) });
      }
    }
  }
  const newItemIds = new Set(after.items.map((i) => i.id));
  for (const [id, item] of oldItems) if (!newItemIds.has(id)) changes.push({ kind: "ITEM_REMOVED", label: label(item) });

  for (const indicator of after.indicators) {
    const was = oldIndicators.get(indicator.id);
    if (!was) {
      changes.push({ kind: "INDICATOR_ADDED", label: indicator.code });
      continue;
    }
    for (const [key, name] of INDICATOR_FIELDS) {
      if (JSON.stringify(was[key]) !== JSON.stringify(indicator[key])) {
        changes.push({ kind: "INDICATOR_CHANGED", label: indicator.code, field: name, from: show(was[key]), to: show(indicator[key]) });
      }
    }
  }
  const newIndicatorIds = new Set(after.indicators.map((i) => i.id));
  for (const [id, indicator] of oldIndicators) if (!newIndicatorIds.has(id)) changes.push({ kind: "INDICATOR_REMOVED", label: indicator.code });
  return changes;
}

/** One sentence for a change, for the history list. */
export function describeLogframeChange(change: LogframeChange): string {
  switch (change.kind) {
    case "ITEM_ADDED":
      return `Added ${change.label}`;
    case "ITEM_REMOVED":
      return `Removed ${change.label}`;
    case "INDICATOR_ADDED":
      return `Added indicator ${change.label}`;
    case "INDICATOR_REMOVED":
      return `Removed indicator ${change.label}`;
    case "ITEM_CHANGED":
    case "INDICATOR_CHANGED":
      return `${change.kind === "INDICATOR_CHANGED" ? "Indicator " : ""}${change.label}: ${change.field} changed from ${change.from} to ${change.to}`;
  }
}

/** A short title for a version, from its changes ("3 changes: Added OUT-4; OUT-1: target changed from 100 to 120; …"). */
export function summarizeLogframeChanges(changes: ReadonlyArray<LogframeChange>, max = 3): string {
  if (changes.length === 0) return "No change";
  const shown = changes.slice(0, max).map(describeLogframeChange).join("; ");
  return `${changes.length} ${changes.length === 1 ? "change" : "changes"}: ${shown}${changes.length > max ? "; …" : ""}`;
}
