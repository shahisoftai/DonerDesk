import { MONEY_SOURCES } from "./sources-money.js";
import { RESULTS_SOURCES } from "./sources-results.js";
import { WORK_SOURCES } from "./sources-work.js";
import type { DataSourceDef, FieldDef } from "./types.js";

/** The one list of what a visual may read. A new source is a row in one of the three files and a reader behind a port. */
export const DATA_SOURCES: readonly DataSourceDef[] = [...RESULTS_SOURCES, ...WORK_SOURCES, ...MONEY_SOURCES];

const BY_ID: ReadonlyMap<string, DataSourceDef> = new Map(DATA_SOURCES.map((s) => [s.id, s]));

/**
 * The catalogue a question is asked against (Phase 54, §3.2): the built-in sources plus any the viewer's datasets add. Every lookup
 * takes it as an optional last argument; absent = the built-in sources only, so existing callers are unchanged.
 */
export type Catalogue = readonly DataSourceDef[];
const indexes = new WeakMap<Catalogue, ReadonlyMap<string, DataSourceDef>>();
function byId(cat?: Catalogue): ReadonlyMap<string, DataSourceDef> {
  if (!cat || cat === DATA_SOURCES) return BY_ID;
  let m = indexes.get(cat);
  if (!m) { m = new Map(cat.map((s) => [s.id, s])); indexes.set(cat, m); }
  return m;
}
/** The built-in sources followed by extra ones (a provider's rows); an extra source never replaces a built-in one. */
export const catalogueWith = (extra: readonly DataSourceDef[]): Catalogue => [...DATA_SOURCES, ...extra.filter((s) => !BY_ID.has(s.id))];

export const sourceOf = (id: string, cat?: Catalogue): DataSourceDef | undefined => byId(cat).get(id);
export const fieldOf = (sourceId: string, fieldId: string, cat?: Catalogue): FieldDef | undefined => byId(cat).get(sourceId)?.fields.find((f) => f.id === fieldId);

/**
 * A field named "source.field" (in a joined source) or just "field" (in the query's own source). A source id may itself hold a dot
 * only through a joined reference, so a dataset source ("dataset:…") is matched before splitting.
 */
export function resolveFieldRef(ref: string, ownSource: string, cat?: Catalogue): { source: string; field: FieldDef } | undefined {
  const own = fieldOf(ownSource, ref, cat);
  if (own) return { source: ownSource, field: own };
  const dot = ref.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const source = ref.slice(0, dot);
  const field = fieldOf(source, ref.slice(dot + 1), cat);
  return field ? { source, field } : undefined;
}

/**
 * The joins two sources share: grouping or filtering across sources is allowed only through one both declare. Every source is of
 * a project, so PROJECT alone says nothing about which row goes with which; it is left out unless a field asks to group by project.
 */
export function sharedJoins(a: string, b: string, cat?: Catalogue): DataSourceDef["joins"] {
  const left = byId(cat).get(a), right = byId(cat).get(b);
  if (!left || !right) return [];
  return left.joins.filter((j) => j !== "PROJECT" && right.joins.includes(j));
}

export interface FieldHit { source: DataSourceDef; field: FieldDef; score: number }

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/**
 * Search the catalogue like the Data panel does ("girls enrolled"): each word of the text that starts a word in the field's label,
 * its meaning or its source scores; a label hit counts most. A field with no hit is not returned, so an empty text returns nothing.
 */
export function searchFields(text: string, limit = 25, cat: Catalogue = DATA_SOURCES): FieldHit[] {
  const wanted = words(text);
  if (wanted.length === 0) return [];
  const exact = text.trim().toLowerCase();
  const hits: FieldHit[] = [];
  for (const source of cat) for (const field of source.fields) {
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
export const guestSources = (cat: Catalogue = DATA_SOURCES): DataSourceDef[] => cat.filter((s) => s.guest);
