/**
 * The four product canvases of Phase 60.3, laid out the way coordination, UN-agency and donor products are read: need to reached
 * (a response dashboard), a one-page country brief, a results table for a situation report, and funding coverage. Like every starter
 * they name roles and write no text of their own, so nothing unwritten can be published; "people in need" and "targeted" come from a
 * recorded indicator or the stage is left out, never a typed guess. Each product is one row of `HUMANITARIAN_PRODUCTS`.
 */
import type { CanvasTemplate } from "./template.js";
import { HOUSE_THEME, block, chart, fig, kpi, page, role } from "./template-kit.js";

const base = { origin: "BUILT_IN" as const, revision: 1 };
const ref = (key: string) => `{{role:${key}}}`;

const NEED_STAGES = [
  { label: "People in need", indicatorId: ref("NEED"), sourceNote: "Recorded indicator" },
  { label: "People targeted", indicatorId: ref("TARGET"), sourceNote: "Recorded indicator" },
  { label: "People reached", bind: "REACH_UNIQUE" },
];

export const HUMANITARIAN_PRODUCTS: readonly CanvasTemplate[] = [
  {
    ...base, id: "builtin-response-dashboard", title: "Response dashboard (need to reached)", family: "AT_A_GLANCE",
    description: "People in need, targeted and reached, who they are, where we work and how each sector is doing. Needs and targets come from recorded indicators.",
    roles: [role("NEED", "Indicator: people in need"), role("TARGET", "Indicator: people targeted")],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("nums", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), fig("Activities done", "ACTIVITIES_DONE"), fig("Activities planned", "ACTIVITIES_PLANNED")] }),
      block("funnel", "FUNNEL", [0, 3, 6, 4], { stages: NEED_STAGES, title: "From need to reach" }),
      block("map", "MAP", [6, 3, 6, 4], { view: "ACTIVITIES", title: "Where we work" }),
      block("demo", "DEMOGRAPHICS", [0, 7, 6, 4], {}), block("reach", "REACH", [6, 7, 6, 4], {}),
      block("sect", "SECTOR_GRID", [0, 11, 12, 4], { sectors: [] }),
      block("msgs", "KEY_MESSAGES", [0, 15, 12, 3], { title: "Situation overview" }),
      block("notes", "LEGEND_NOTES", [0, 18, 12, 2], {}),
    ]) },
  },
  {
    ...base, id: "builtin-country-brief", title: "Country brief (one page)", family: "DONOR",
    description: "A one-page operational brief: headline figures, targeted against reached, where, who, funding and what comes next.",
    roles: [role("TARGET", "Indicator: people targeted")],
    canvas: { profile: "DONOR_REPORT", mode: "PUBLISHED_ONLY", language: "en", themeId: HOUSE_THEME, pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("nums", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), fig("People registered", "REACH_REGISTERED"), fig("Activities done", "ACTIVITIES_DONE")] }),
      block("msgs", "KEY_MESSAGES", [0, 3, 12, 3], { title: "Operational update" }),
      block("funnel", "FUNNEL", [0, 6, 6, 4], { stages: [NEED_STAGES[1]!, NEED_STAGES[2]!], title: "Targeted and reached" }),
      block("demo", "DEMOGRAPHICS", [6, 6, 6, 4], {}),
      block("map", "MAP", [0, 10, 12, 5], { view: "ACTIVITIES", title: "Where we work" }),
      block("fund", "FUNDING", [0, 15, 12, 3], { title: "Resources" }),
      block("time", "TIMELINE", [0, 18, 12, 3], { title: "What comes next" }),
      block("notes", "LEGEND_NOTES", [0, 21, 12, 2], {}),
    ], "A4_PORTRAIT") },
  },
  {
    ...base, id: "builtin-results-table", title: "Results table (situation report)", family: "FLASH",
    description: "The results a situation report carries: each indicator against its target, progress, and a table by period.",
    roles: [role("A", "First indicator", true), role("B", "Second indicator"), role("C", "Third indicator"), role("D", "Fourth indicator")],
    canvas: { profile: "SNAPSHOT", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("msgs", "KEY_MESSAGES", [0, 1, 12, 3], { title: "Situation overview" }),
      block("tbl", "TABLE", [0, 4, 12, 5], { title: "Results to date against targets", query: { indicatorIds: [ref("A"), ref("B"), ref("C"), ref("D")], measure: "CUMULATIVE", rows: "INDICATOR", includeDraft: false } }),
      block("rings", "PROGRESS_RINGS", [0, 9, 6, 4], { indicatorIds: [ref("A"), ref("B"), ref("C")], title: "Progress to target" }),
      chart("trend", [6, 9, 6, 4], "A", "LINE", "Trend"),
      block("notes", "LEGEND_NOTES", [0, 13, 12, 2], {}),
    ]) },
  },
  {
    ...base, id: "builtin-funding-coverage", title: "Funding coverage", family: "FINANCE",
    description: "Money agreed, received and still to receive, and how it is being spent. Needs finance to be recorded for the project.",
    roles: [],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("m1", "METRIC", [0, 0, 3, 2], { metric: "FIN_OBLIGATED" }), block("m2", "METRIC", [3, 0, 3, 2], { metric: "FIN_RECEIVED" }),
      block("m3", "METRIC", [6, 0, 3, 2], { metric: "FIN_SPENT" }), block("m4", "METRIC", [9, 0, 3, 2], { metric: "FIN_REMAINING" }),
      block("fund", "FUNDING", [0, 2, 12, 4], { title: "Budget and spending by period" }),
      block("notes", "LEGEND_NOTES", [0, 6, 12, 2], {}),
    ]) },
  },
];
