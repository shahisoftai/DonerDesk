/**
 * Starter canvases in the humanitarian conventions (Phase 45.7): a flash update, results at a glance, who we reached, funding and burn,
 * who-does-what-where, field operations, a donor one-pager and a sector scorecard. Each names roles (an indicator the person chooses),
 * never an indicator, a project or a figure; a block whose optional role is unchosen is left out, never drawn from a guess. Every one
 * runs live as a dashboard and publishes as an infographic. They are drafts the person edits freely; applying one never fills authored
 * text, so nothing unwritten can be published by accident.
 */
import type { CanvasTemplate } from "./template.js";
import { HOUSE_THEME, block, chart, fig, kpi, page, role } from "./template-kit.js";
import { HUMANITARIAN_PRODUCTS } from "./templates-humanitarian.js";
import { LIBRARY_CANVAS_TEMPLATES } from "../sector-library/generated-templates.js";

const base = { origin: "BUILT_IN" as const, revision: 1 };

const CORE_CANVAS_TEMPLATES: readonly CanvasTemplate[] = [
  {
    ...base, id: "builtin-flash-update", title: "Flash update", family: "FLASH",
    description: "A one-page update after an event or a period: headline figures, who was reached, what changed, and who is doing what where.",
    roles: [role("MAIN", "The headline indicator", true), role("SECOND", "A second indicator"), role("THIRD", "A third indicator")],
    canvas: { profile: "SNAPSHOT", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("people", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), fig("Activities done", "ACTIVITIES_DONE"), fig("Activities planned", "ACTIVITIES_PLANNED")] }),
      kpi("k1", [0, 3, 4, 2], "MAIN"), kpi("k2", [4, 3, 4, 2], "SECOND"), kpi("k3", [8, 3, 4, 2], "THIRD"),
      block("who", "DEMOGRAPHICS", [0, 5, 6, 4], {}), block("where", "REACH", [6, 5, 6, 4], {}),
      block("msgs", "KEY_MESSAGES", [0, 9, 12, 3], { title: "What changed" }),
      block("w3", "THREE_W", [0, 12, 12, 4], { title: "Who does what, where" }),
      block("notes", "LEGEND_NOTES", [0, 16, 12, 2], {}),
    ]) },
  },
  {
    ...base, id: "builtin-results-glance", title: "Results at a glance", family: "AT_A_GLANCE",
    description: "How the project is doing against its targets: key indicators, progress, one trend and the full table.",
    roles: [role("A", "First indicator", true), role("B", "Second indicator"), role("C", "Third indicator"), role("D", "Fourth indicator")],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      kpi("k1", [0, 0, 3, 2], "A"), kpi("k2", [3, 0, 3, 2], "B"), kpi("k3", [6, 0, 3, 2], "C"), kpi("k4", [9, 0, 3, 2], "D"),
      chart("trend", [0, 2, 8, 4], "A", "LINE", "Trend"),
      block("rings", "PROGRESS_RINGS", [8, 2, 4, 4], { indicatorIds: ["{{role:A}}", "{{role:B}}", "{{role:C}}"], title: "Progress to target" }),
      block("tbl", "TABLE", [0, 6, 12, 4], { title: "Values by period", query: { indicatorIds: ["{{role:A}}"], measure: "PERIOD", rows: "PERIOD", includeDraft: false } }),
    ]) },
  },
  {
    ...base, id: "builtin-people-reached", title: "People reached", family: "BENEFICIARIES",
    description: "Who the work reached: the total, the breakdown by sex and age, where, and the path from people in need to people reached.",
    roles: [],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("nums", "BIG_NUMBERS", [0, 0, 12, 2], { numbers: [fig("People reached (unique)", "REACH_UNIQUE"), fig("People registered", "REACH_REGISTERED")] }),
      block("demo", "DEMOGRAPHICS", [0, 2, 6, 4], {}), block("reach", "REACH", [6, 2, 6, 4], {}),
      block("funnel", "FUNNEL", [0, 6, 6, 4], { stages: [{ label: "People in need" }, { label: "People targeted" }, { label: "People reached", bind: "REACH_UNIQUE" }], title: "From need to reach" }),
      block("acts", "ACTIVITIES_BY_LOCATION", [6, 6, 6, 4], {}),
    ]) },
  },
  {
    ...base, id: "builtin-funding-burn", title: "Funding and burn", family: "FINANCE",
    description: "Money received and spent, and how fast: the figures a finance review looks at first. Needs finance to be recorded for the project.",
    roles: [],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("m1", "METRIC", [0, 0, 3, 2], { metric: "FIN_OBLIGATED" }), block("m2", "METRIC", [3, 0, 3, 2], { metric: "FIN_RECEIVED" }),
      block("m3", "METRIC", [6, 0, 3, 2], { metric: "FIN_SPENT" }), block("m4", "METRIC", [9, 0, 3, 2], { metric: "FIN_REMAINING" }),
      block("fund", "FUNDING", [0, 2, 12, 4], { title: "Budget and spending by period" }),
      block("notes", "LEGEND_NOTES", [0, 6, 12, 2], {}),
    ]) },
  },
  {
    ...base, id: "builtin-3w-coverage", title: "Who does what, where (3W)", family: "THREE_W",
    description: "Coverage by organisation and place, with where the activities are and how delivery stands.",
    roles: [],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("w3", "THREE_W", [0, 0, 12, 4], { title: "Who does what, where" }),
      block("map", "MAP", [0, 4, 7, 6], { view: "ACTIVITIES", title: "Where the activities are" }),
      block("acts", "ACTIVITIES_BY_LOCATION", [7, 4, 5, 6], {}),
      block("sect", "SECTOR_GRID", [0, 10, 12, 4], { sectors: [] }),
    ]) },
  },
  {
    ...base, id: "builtin-field-operations", title: "Field operations", family: "FIELD",
    description: "For the field team: how many activities are done, in progress and late, where they are, and what is coming.",
    roles: [],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("a1", "METRIC", [0, 0, 3, 2], { metric: "ACTIVITIES_TOTAL" }), block("a2", "METRIC", [3, 0, 3, 2], { metric: "ACTIVITIES_IN_PROGRESS" }),
      block("a3", "METRIC", [6, 0, 3, 2], { metric: "ACTIVITIES_DONE" }), block("a4", "METRIC", [9, 0, 3, 2], { metric: "ACTIVITIES_LATE" }),
      block("map", "MAP", [0, 2, 7, 6], { view: "ACTIVITIES", title: "Where we work" }),
      block("acts", "ACTIVITIES_BY_LOCATION", [7, 2, 5, 6], {}),
      block("time", "TIMELINE", [0, 8, 12, 4], { title: "What is coming" }),
    ]) },
  },
  {
    ...base, id: "builtin-donor-one-pager", title: "Donor one-pager", family: "DONOR",
    description: "A page for a donor: the headline figures, one chart, the story in the people's own words, and where every figure comes from.",
    roles: [role("MAIN", "The headline indicator", true), role("SECOND", "A second indicator")],
    canvas: { profile: "DONOR_REPORT", mode: "PUBLISHED_ONLY", language: "en", themeId: HOUSE_THEME, pages: page([
      block("banner", "BANNER", [0, 0, 12, 1], {}),
      block("nums", "BIG_NUMBERS", [0, 1, 12, 2], { numbers: [fig("People reached", "REACH_UNIQUE"), { label: "Headline indicator", source: "INDICATOR", indicatorId: "{{role:MAIN}}" }, { label: "Second indicator", source: "INDICATOR", indicatorId: "{{role:SECOND}}" }] }),
      block("msgs", "KEY_MESSAGES", [0, 3, 6, 4], {}),
      Object.assign(chart("trend", [6, 3, 6, 4], "MAIN", "BAR", "Progress over time"), { alt: "" }),
      block("quote", "QUOTE", [0, 7, 12, 3], {}),
      block("notes", "LEGEND_NOTES", [0, 10, 12, 2], {}),
    ], "A4_PORTRAIT") },
  },
  {
    ...base, id: "builtin-sector-scorecard", title: "Sector scorecard", family: "SECTOR_RESULTS",
    description: "Results by sector (for example water, health, protection): one card per sector with its indicators and progress to target.",
    roles: [role("W1", "Water indicator"), role("W2", "Sanitation indicator"), role("H1", "Health indicator"), role("N1", "Nutrition indicator")],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: HOUSE_THEME, pages: page([
      block("sectors", "SECTOR_GRID", [0, 0, 12, 6], { sectors: [{ label: "Water and sanitation", indicatorIds: ["{{role:W1}}", "{{role:W2}}"] }, { label: "Health and nutrition", indicatorIds: ["{{role:H1}}", "{{role:N1}}"] }] }),
      block("rings", "PROGRESS_RINGS", [0, 6, 12, 4], { indicatorIds: ["{{role:W1}}", "{{role:H1}}"], title: "Progress to target" }),
    ]) },
  },
];

/** The eight general starters, the four humanitarian products, then one results canvas per sector built from the sector library. */
export const BUILT_IN_CANVAS_TEMPLATES: readonly CanvasTemplate[] = [...CORE_CANVAS_TEMPLATES, ...HUMANITARIAN_PRODUCTS, ...LIBRARY_CANVAS_TEMPLATES];

export const builtInCanvasTemplate = (id: string): CanvasTemplate | undefined => BUILT_IN_CANVAS_TEMPLATES.find((t) => t.id === id);
