import { MONEY_SOURCES } from "./sources-money.js";
import { RESULTS_SOURCES } from "./sources-results.js";
import { WORK_SOURCES } from "./sources-work.js";
import type { DataSourceDef, FieldDef } from "./types.js";

/** The one list of what a visual may read. A new source is a row in one of the three files and a reader behind a port. */
export const DATA_SOURCES: readonly DataSourceDef[] = [...RESULTS_SOURCES, ...WORK_SOURCES, ...MONEY_SOURCES];

const BY_ID: ReadonlyMap<string, DataSourceDef> = new Map(DATA_SOURCES.map((s) => [s.id, s]));

export const sourceOf = (id: string): DataSourceDef | undefined => BY_ID.get(id);
export const fieldOf = (sourceId: string, fieldId: string): FieldDef | undefined => BY_ID.get(sourceId)?.fields.find((f) => f.id === fieldId);

/** A field named "source.field" (in a joined source) or just "field" (in the query's own source). */
export function resolveFieldRef(ref: string, ownSource: string): { source: string; field: FieldDef } | undefined {
  const dot = ref.indexOf(".");
  const source = dot > 0 ? ref.slice(0, dot) : ownSource;
  const id = dot > 0 ? ref.slice(dot + 1) : ref;
  const field = fieldOf(source, id);
  return field ? { source, field } : undefined;
}

/**
 * The joins two sources share: grouping or filtering across sources is allowed only through one both declare. Every source is of
 * a project, so PROJECT alone says nothing about which row goes with which; it is left out unless a field asks to group by project.
 */
export function sharedJoins(a: string, b: string): DataSourceDef["joins"] {
  const left = BY_ID.get(a), right = BY_ID.get(b);
  if (!left || !right) return [];
  return left.joins.filter((j) => j !== "PROJECT" && right.joins.includes(j));
}

export interface FieldHit { source: DataSourceDef; field: FieldDef; score: number }

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/**
 * Search the catalogue like the Data panel does ("girls enrolled"): each word of the text that starts a word in the field's label,
 * its meaning or its source scores; a label hit counts most. A field with no hit is not returned, so an empty text returns nothing.
 */
export function searchFields(text: string, limit = 25): FieldHit[] {
  const wanted = words(text);
  if (wanted.length === 0) return [];
  const exact = text.trim().toLowerCase();
  const hits: FieldHit[] = [];
  for (const source of DATA_SOURCES) for (const field of source.fields) {
    const label = words(field.label), meaning = words(field.meaning), home = words(`${source.label} ${source.description}`);
    let score = 0;
    for (const w of wanted) {
      if (label.some((l) => l.startsWith(w))) score += 3;
      else if (meaning.some((m) => m.startsWith(w))) score += 2;
      else if (home.some((h) => h.startsWith(w))) score += 1;
    }
    if (score > 0) hits.push({ source, field, score: score + (field.label.toLowerCase() === exact ? 5 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score || a.field.label.localeCompare(b.field.label)).slice(0, limit);
}

/** What an outside guest on a share link may read. */
export const guestSources = (): DataSourceDef[] => DATA_SOURCES.filter((s) => s.guest);
