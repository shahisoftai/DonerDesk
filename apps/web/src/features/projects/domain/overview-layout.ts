/**
 * How a project's Overview is arranged by the person reading it. Pure: no React, no storage.
 *
 * Which parts a role may see is still `sectionsFor` (overview-sections.ts): an arrangement only orders, sizes or hides parts that are
 * already shown, so a stored arrangement can never reveal one. "Needs you" always stays on top and is not arranged.
 */
import { defaultArrangement, resolveArrangement, type Arrangement, type PanelCatalogue } from "../../dashboard/domain/arrangement.ts";
import { OVERVIEW_SECTION_ORDER, type OverviewSection } from "./overview-sections.ts";

export type OverviewPanel = Exclude<OverviewSection, "NEEDS_YOU">;

/** The stored arrangement's name: one per person, the same for every project. */
export const OVERVIEW_LAYOUT_VARIANT = "PROJECT" as const;

/** Widths per part; exhaustive over `OverviewPanel`. Parts with a row of cards or a table stay full width. */
export const OVERVIEW_PANEL_INFO: PanelCatalogue<OverviewPanel> = {
  PULSE: { defaultSpan: 12, spans: [12] },
  CALENDAR: { defaultSpan: 12, spans: [6, 12] },
  REPORTING: { defaultSpan: 12, spans: [12] },
  DELIVERY: { defaultSpan: 12, spans: [12] },
  LOCATION: { defaultSpan: 12, spans: [6, 8, 12] },
  RESULTS: { defaultSpan: 12, spans: [12] },
  TEAM: { defaultSpan: 12, spans: [8, 12] },
  RISKS: { defaultSpan: 12, spans: [6, 8, 12] },
  CLOSEOUT: { defaultSpan: 12, spans: [6, 12] },
  SETUP: { defaultSpan: 12, spans: [6, 12] },
};

const isPanel = (s: OverviewSection): s is OverviewPanel => s !== "NEEDS_YOU";

/** The parts this person sees, in the default order. */
export const overviewPanels = (shown: ReadonlyArray<OverviewSection>): OverviewPanel[] =>
  OVERVIEW_SECTION_ORDER.filter((s): s is OverviewPanel => isPanel(s) && shown.includes(s));

/**
 * Parts a person who has not arranged the page does not see at first (Phase 65): the page opens on the next step and a few summaries.
 * The parts stay one tick away in "Customise", and a saved arrangement always wins. Setup is the checklist now.
 */
export const OVERVIEW_HIDDEN_BY_DEFAULT: ReadonlyArray<OverviewPanel> = ["LOCATION", "TEAM", "SETUP"];

export const defaultOverviewLayout = (shown: ReadonlyArray<OverviewSection>): Arrangement<OverviewPanel> =>
  defaultArrangement(OVERVIEW_PANEL_INFO, overviewPanels(shown)).map((p) => (OVERVIEW_HIDDEN_BY_DEFAULT.includes(p.key) ? { ...p, hidden: true } : p));

export const resolveOverviewLayout = (shown: ReadonlyArray<OverviewSection>, stored: unknown): Arrangement<OverviewPanel> =>
  Array.isArray(stored) && stored.length > 0
    ? resolveArrangement(OVERVIEW_PANEL_INFO, overviewPanels(shown), stored)
    : defaultOverviewLayout(shown);
