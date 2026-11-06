/**
 * How the body of Home is laid out (Phase 40). Pure: no React, no clock, no storage.
 *
 * A layout is an ordered list of panels, each with a width and a hidden flag. It stores positions, never data, and it can only
 * hide or move what the role already shows (`HOME_TILES_BY_VARIANT` stays the rule for visibility): a saved layout never reveals a panel,
 * a panel added in a later release appears at the end, and anything unreadable falls back to the default.
 *
 * Single responsibility per piece: the catalogue (`PANEL_INFO`), the default order (`DEFAULT_ORDER`), reading a stored value (`resolveLayout`),
 * checking one (`checkHomeLayout`) and the edits (`movePanel`, `setSpan`, `setHidden`).
 */
import type { HomeVariant } from "../../navigation/domain/role-navigation.ts";
import { HOME_TILES_BY_VARIANT, type HomeTile } from "./home-tiles.ts";

/** Parts that always sit above the layout (what needs the person, pins, bookmarks): not arranged. */
export type FixedPanel = "NEEDS_YOU" | "PINNED" | "BOOKMARKS";
export type LayoutPanel = Exclude<HomeTile, FixedPanel>;

/** Widths on a 12-column grid. On a phone and a tablet every panel is full width. */
export const PANEL_SPANS = [4, 6, 8, 12] as const;
export type PanelSpan = (typeof PANEL_SPANS)[number];

export interface Placement { readonly key: LayoutPanel; readonly span: PanelSpan; readonly hidden: boolean }
export type HomeLayout = ReadonlyArray<Placement>;

interface PanelInfo { readonly defaultSpan: PanelSpan; readonly spans: ReadonlyArray<PanelSpan> }
const ALL: ReadonlyArray<PanelSpan> = PANEL_SPANS;

/** One row per panel; exhaustive over `LayoutPanel`, so a new panel cannot be added without deciding its widths. */
export const PANEL_INFO: Readonly<Record<LayoutPanel, PanelInfo>> = {
  HEADLINES: { defaultSpan: 12, spans: [12] },
  FUNDING: { defaultSpan: 12, spans: [8, 12] },
  MAP: { defaultSpan: 12, spans: [6, 8, 12] },
  BREAKDOWNS: { defaultSpan: 12, spans: [6, 8, 12] },
  PROJECT_HEALTH: { defaultSpan: 8, spans: [8, 12] },
  UPCOMING_REPORTS: { defaultSpan: 4, spans: [4, 6, 12] },
  PIPELINE: { defaultSpan: 12, spans: [8, 12] },
  RESULTS: { defaultSpan: 6, spans: [4, 6, 8, 12] },
  RISKS: { defaultSpan: 6, spans: [4, 6, 8, 12] },
  DELIVERY: { defaultSpan: 4, spans: ALL },
  DATA_EVIDENCE: { defaultSpan: 4, spans: ALL },
  NOTIFICATIONS: { defaultSpan: 4, spans: ALL },
  YOUR_WORK: { defaultSpan: 6, spans: [4, 6, 8, 12] },
  GRANTS: { defaultSpan: 6, spans: [4, 6, 8, 12] },
  QUICK_LINKS: { defaultSpan: 12, spans: [6, 8, 12] },
};

/** Heavy panels first, then panels of a similar height side by side, so a short panel is not stretched beside a tall one. */
export const DEFAULT_ORDER: ReadonlyArray<LayoutPanel> = [
  "HEADLINES", "FUNDING", "MAP", "BREAKDOWNS", "PROJECT_HEALTH", "UPCOMING_REPORTS", "PIPELINE", "RESULTS", "RISKS",
  "DELIVERY", "DATA_EVIDENCE", "NOTIFICATIONS", "YOUR_WORK", "GRANTS", "QUICK_LINKS",
];

export const isLayoutPanel = (k: unknown): k is LayoutPanel => typeof k === "string" && Object.hasOwn(PANEL_INFO, k);
export const isPanelSpan = (n: unknown): n is PanelSpan => typeof n === "number" && (PANEL_SPANS as ReadonlyArray<number>).includes(n);

/** The panels a variant may show, in default order. */
export const panelsFor = (variant: HomeVariant): LayoutPanel[] => DEFAULT_ORDER.filter((k) => HOME_TILES_BY_VARIANT[variant].has(k));

export const defaultLayout = (variant: HomeVariant): HomeLayout =>
  panelsFor(variant).map((key) => ({ key, span: PANEL_INFO[key].defaultSpan, hidden: false }));

const spanOk = (key: LayoutPanel, span: unknown): span is PanelSpan => isPanelSpan(span) && PANEL_INFO[key].spans.includes(span);

/**
 * Reads a stored layout for a variant. Never throws: an entry that is unknown, not allowed for the role, repeated or malformed is skipped;
 * a width the panel does not offer becomes its default; panels the stored value does not mention are added at the end, shown.
 */
export function resolveLayout(variant: HomeVariant, stored: unknown): HomeLayout {
  const allowed = new Set(panelsFor(variant));
  const seen = new Set<LayoutPanel>();
  const out: Placement[] = [];
  if (Array.isArray(stored)) {
    for (const raw of stored as unknown[]) {
      if (typeof raw !== "object" || raw === null) continue;
      const { key, span, hidden } = raw as Record<string, unknown>;
      if (!isLayoutPanel(key) || !allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, span: spanOk(key, span) ? span : PANEL_INFO[key].defaultSpan, hidden: hidden === true });
    }
  }
  for (const key of panelsFor(variant)) if (!seen.has(key)) out.push({ key, span: PANEL_INFO[key].defaultSpan, hidden: false });
  return out;
}

/** Why a layout cannot be saved; empty when it can. The server and the edit mode ask this same function. */
export function checkHomeLayout(variant: HomeVariant, layout: unknown): string[] {
  if (!Array.isArray(layout)) return ["The layout must be a list."];
  const problems: string[] = [];
  const allowed = new Set(panelsFor(variant));
  const seen = new Set<string>();
  for (const raw of layout as unknown[]) {
    const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    if (!isLayoutPanel(e.key)) { problems.push("A panel is not one that Home has."); continue; }
    if (!allowed.has(e.key)) problems.push(`${e.key} is not shown to this role.`);
    if (seen.has(e.key)) problems.push(`${e.key} appears twice.`);
    seen.add(e.key);
    if (!spanOk(e.key, e.span)) problems.push(`${e.key} cannot have that width.`);
    if (typeof e.hidden !== "boolean") problems.push(`${e.key} needs a hidden flag.`);
  }
  return problems;
}

/** Moves a panel one place earlier (-1) or later (+1) among all panels, hidden ones included. Unchanged at an end or for an unknown key. */
export function movePanel(layout: HomeLayout, key: LayoutPanel, direction: -1 | 1): HomeLayout {
  const i = layout.findIndex((p) => p.key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  const next = [...layout];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Changes a panel's width; `null` when the panel does not offer it (the caller keeps the old layout). */
export function setSpan(layout: HomeLayout, key: LayoutPanel, span: PanelSpan): HomeLayout | null {
  if (!spanOk(key, span) || !layout.some((p) => p.key === key)) return null;
  return layout.map((p) => (p.key === key ? { ...p, span } : p));
}

export const setHidden = (layout: HomeLayout, key: LayoutPanel, hidden: boolean): HomeLayout => layout.map((p) => (p.key === key ? { ...p, hidden } : p));

/** What is stored: positions and flags only. */
export const toStoredLayout = (layout: HomeLayout): Array<{ key: LayoutPanel; span: PanelSpan; hidden: boolean }> => layout.map((p) => ({ key: p.key, span: p.span, hidden: p.hidden }));

export const sameLayout = (a: HomeLayout, b: HomeLayout): boolean =>
  a.length === b.length && a.every((p, i) => p.key === b[i]!.key && p.span === b[i]!.span && p.hidden === b[i]!.hidden);
