/**
 * The pure rules for arranging a page of panels (Home, a project's Overview). Pure: no React, no clock, no storage.
 *
 * An arrangement is an ordered list of panels, each with a width and a hidden flag. It stores positions, never data, and it can only
 * hide or move what the page already shows: a panel the page may not show is dropped, one the stored value does not mention is added
 * at the end, and anything unreadable falls back to the default.
 */

/** Widths on a 12-column grid. On a phone and a tablet every panel is full width. */
export const PANEL_SPANS = [4, 6, 8, 12] as const;
export type PanelSpan = (typeof PANEL_SPANS)[number];

export interface Placement<K extends string> { readonly key: K; readonly span: PanelSpan; readonly hidden: boolean }
export type Arrangement<K extends string> = ReadonlyArray<Placement<K>>;
export interface PanelWidths { readonly defaultSpan: PanelSpan; readonly spans: ReadonlyArray<PanelSpan> }
export type PanelCatalogue<K extends string> = Readonly<Record<K, PanelWidths>>;

export const isPanelSpan = (n: unknown): n is PanelSpan => typeof n === "number" && (PANEL_SPANS as ReadonlyArray<number>).includes(n);
const spanOk = <K extends string>(info: PanelCatalogue<K>, key: K, span: unknown): span is PanelSpan => isPanelSpan(span) && info[key].spans.includes(span);

export const defaultArrangement = <K extends string>(info: PanelCatalogue<K>, panels: ReadonlyArray<K>): Arrangement<K> =>
  panels.map((key) => ({ key, span: info[key].defaultSpan, hidden: false }));

/** Reads a stored arrangement against the panels the page may show (in default order). Never throws. */
export function resolveArrangement<K extends string>(info: PanelCatalogue<K>, panels: ReadonlyArray<K>, stored: unknown): Arrangement<K> {
  const allowed = new Set<string>(panels);
  const seen = new Set<string>();
  const out: Array<Placement<K>> = [];
  if (Array.isArray(stored)) {
    for (const raw of stored as unknown[]) {
      if (typeof raw !== "object" || raw === null) continue;
      const { key, span, hidden } = raw as Record<string, unknown>;
      if (typeof key !== "string" || !allowed.has(key) || seen.has(key)) continue;
      const k = key as K;
      seen.add(k);
      out.push({ key: k, span: spanOk(info, k, span) ? span : info[k].defaultSpan, hidden: hidden === true });
    }
  }
  for (const key of panels) if (!seen.has(key)) out.push({ key, span: info[key].defaultSpan, hidden: false });
  return out;
}

/** Moves a panel one place earlier (-1) or later (+1), hidden ones included. Unchanged at an end or for an unknown key. */
export function movePlacement<K extends string>(layout: Arrangement<K>, key: K, direction: -1 | 1): Arrangement<K> {
  const i = layout.findIndex((p) => p.key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  const next = [...layout];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Changes a panel's width; `null` when the panel does not offer it (the caller keeps the old arrangement). */
export function setPlacementSpan<K extends string>(info: PanelCatalogue<K>, layout: Arrangement<K>, key: K, span: PanelSpan): Arrangement<K> | null {
  if (!spanOk(info, key, span) || !layout.some((p) => p.key === key)) return null;
  return layout.map((p) => (p.key === key ? { ...p, span } : p));
}

export const setPlacementHidden = <K extends string>(layout: Arrangement<K>, key: K, hidden: boolean): Arrangement<K> =>
  layout.map((p) => (p.key === key ? { ...p, hidden } : p));

/** What is stored: positions and flags only. */
export const toStored = <K extends string>(layout: Arrangement<K>): Array<{ key: K; span: PanelSpan; hidden: boolean }> =>
  layout.map((p) => ({ key: p.key, span: p.span, hidden: p.hidden }));

export const sameArrangement = <K extends string>(a: Arrangement<K>, b: Arrangement<K>): boolean =>
  a.length === b.length && a.every((p, i) => p.key === b[i]!.key && p.span === b[i]!.span && p.hidden === b[i]!.hidden);
