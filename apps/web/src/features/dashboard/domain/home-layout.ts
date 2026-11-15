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
import {
  PANEL_SPANS, defaultArrangement, isPanelSpan, movePlacement, resolveArrangement, sameArrangement, setPlacementHidden, setPlacementSpan, toStored,
  type PanelSpan, type PanelWidths, type Placement as AnyPlacement,
} from "./arrangement.ts";

export { PANEL_SPANS, isPanelSpan, type PanelSpan };

/** Parts that always sit above the layout (what needs the person, pins, bookmarks): not arranged. */
export type FixedPanel = "NEEDS_YOU" | "PINNED" | "BOOKMARKS";
export type LayoutPanel = Exclude<HomeTile, FixedPanel>;

export type Placement = AnyPlacement<LayoutPanel>;
export type HomeLayout = ReadonlyArray<Placement>;

type PanelInfo = PanelWidths;
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

/** The panels a variant may show, in default order. */
export const panelsFor = (variant: HomeVariant): LayoutPanel[] => DEFAULT_ORDER.filter((k) => HOME_TILES_BY_VARIANT[variant].has(k));

export const defaultLayout = (variant: HomeVariant): HomeLayout => defaultArrangement(PANEL_INFO, panelsFor(variant));

const spanOk = (key: LayoutPanel, span: unknown): span is PanelSpan => isPanelSpan(span) && PANEL_INFO[key].spans.includes(span);

/**
 * Reads a stored layout for a variant. Never throws: an entry that is unknown, not allowed for the role, repeated or malformed is skipped;
 * a width the panel does not offer becomes its default; panels the stored value does not mention are added at the end, shown.
 */
export const resolveLayout = (variant: HomeVariant, stored: unknown): HomeLayout => resolveArrangement(PANEL_INFO, panelsFor(variant), stored);

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

export const movePanel = (layout: HomeLayout, key: LayoutPanel, direction: -1 | 1): HomeLayout => movePlacement(layout, key, direction);
export const setSpan = (layout: HomeLayout, key: LayoutPanel, span: PanelSpan): HomeLayout | null => setPlacementSpan(PANEL_INFO, layout, key, span);
export const setHidden = (layout: HomeLayout, key: LayoutPanel, hidden: boolean): HomeLayout => setPlacementHidden(layout, key, hidden);
export const toStoredLayout = (layout: HomeLayout): Array<{ key: LayoutPanel; span: PanelSpan; hidden: boolean }> => toStored(layout);
export const sameLayout = (a: HomeLayout, b: HomeLayout): boolean => sameArrangement(a, b);
