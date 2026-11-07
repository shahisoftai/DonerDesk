/**
 * One sample per block (Phase 45): the props, and the data its `resolve` is given. The completeness, honesty and parity tests
 * walk this table, so a block cannot be added to the registry without a fixture (the type is exhaustive over `BlockKind`).
 * Every data-bound sample includes a gap - a month nobody recorded - because a gap that turns into 0 is the bug these samples exist to catch.
 */
import type { DataSheet } from "../reporting/data-sheet.js";
import { resolveDataset } from "../reporting/dataset-query.js";
import type { BlockKind } from "./blocks/registry.js";
import type { CanvasFacts } from "./facts.js";

export interface BlockFixture {
  props: unknown;
  /** What `resolve` is given for this block; absent for a block that reads nothing. */
  data?: unknown;
}

const periods = ["Jan", "Feb", "Mar"].map((label, i) => ({ id: `p${i + 1}`, label: `${label} 2026`, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const indicator = (id: string, extra: Record<string, unknown> = {}) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false, ...extra });

/** Indicator "a" has no figure for February (a gap); indicator "r" is a rate. */
export const SAMPLE_SHEET: DataSheet = {
  projectId: "sample", periods, finance: [],
  indicators: [indicator("a"), indicator("r", { type: "PERCENTAGE", unit: "%", isRate: true, target: "90" })] as DataSheet["indicators"],
  cells: [
    { indicatorId: "a", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" },
    { indicatorId: "a", periodId: "p3", periodValue: "30", cumulativeValue: "40", status: "VERIFIED" },
    { indicatorId: "r", periodId: "p1", periodValue: "60", cumulativeValue: "60", status: "VERIFIED" },
    { indicatorId: "r", periodId: "p2", periodValue: "65", cumulativeValue: "65", status: "VERIFIED" },
    { indicatorId: "r", periodId: "p3", periodValue: "70", cumulativeValue: "70", status: "VERIFIED" },
  ],
};

/** Siaya has no recorded actual (a gap), one finance row is not verified, and indicator "zz" does not exist: each must come out as a gap or a note, never 0. */
export const SAMPLE_FACTS: CanvasFacts = {
  sheet: SAMPLE_SHEET,
  reach: {
    overallUnique: 120, registeredTotal: 125, beneficiariesWithoutLocation: 5, attendancesWithoutLocation: 0,
    registeredByLocation: [{ key: "kisumu", location: "Kisumu", unique: 80 }, { key: "siaya", location: "Siaya", unique: 40 }],
    attendancesByActivityLocation: [{ key: "kisumu", location: "Kisumu", attendances: 200 }],
    bySex: { female: 70, male: 50 }, byAgeGroup: { AGE_5_17: 30, UNDER_5: 10, AGE_18_59: 80 },
  },
  activities: { rows: [{ key: "kisumu", location: "Kisumu", planned: 4, done: 2, late: 1, cancelled: 0 }], unlocated: 1 },
  finance: { enabled: true, rows: [
    { periodId: "p1", currency: "USD", budget: "1000", expenditure: "100", balance: "900", burnRatePercent: "10", verified: true },
    { periodId: "p3", currency: "USD", budget: "1000", expenditure: "400", balance: "600", verified: false },
  ] },
  indicators: [{
    id: "a", code: "A", name: "Indicator a",
    location: { kind: "ADDITIVE", rows: [
      { key: "kisumu", location: "Kisumu", value: "25", verified: true, unverified: 0, series: [] },
      { key: "siaya", location: "Siaya", value: "15", verified: false, unverified: 1, series: [] },
    ] },
    targetActual: { kind: "WITH_TARGETS", rows: [
      { key: "kisumu", location: "Kisumu", target: "50", actual: "25", percentOfTarget: "50" },
      { key: "siaya", location: "Siaya", target: "30", actual: null },
    ] },
  }],
};
const withFacts = (props: unknown): BlockFixture => ({ props, data: SAMPLE_FACTS });

const dataset = (ids: string[]) => resolveDataset(SAMPLE_SHEET, { indicatorIds: ids, measure: "PERIOD", includeDraft: false });
const chartSpec = { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: false } };
const tableQuery = { indicatorIds: ["a"], measure: "PERIOD", rows: "PERIOD", includeDraft: false };
const plan = (status: string, signal: string) => ({ id: status, title: `Activity ${status}`, kind: "ACTIVITY" as const, start: "2026-01-05", end: "2026-02-20", status, signal, signalLabel: signal });
const portfolioFixture = (title: string): BlockFixture => ({
  props: { title },
  data: {
    ...SAMPLE_FACTS,
    portfolio: {
      asAt: "2026-03-31",
      totals: { projects: 2, countries: 2, behind: 1, needAttention: 0, openRisks: 3, reportsOverdue: 1, onTrack: 1, noPlan: 0 },
      rows: [
        { title: "Water for Kisumu", donorName: "Example Donor", country: "Kenya", band: "ON_TRACK", nextReport: { deadline: "2026-04-30", daysUntil: 30 } },
        { title: "Schools in Gulu", donorName: "Example Donor", country: "Uganda", band: "OFF_TRACK", nextReport: { deadline: "2026-03-01", daysUntil: -30 } },
      ],
      countries: [{ country: "Kenya", projects: 1, onTrack: 1, atRisk: 0, offTrack: 0, noPlan: 0 }, { country: "Uganda", projects: 1, onTrack: 0, atRisk: 0, offTrack: 1, noPlan: 0 }],
    },
  },
});
const titled = (title: string) => ({ props: { title } });

export const BLOCK_FIXTURES: Readonly<Record<BlockKind, BlockFixture>> = {
  TEXT: { props: { text: "# Water for Kisumu\nBoreholes now serve more homes.", role: "body" } },
  DIVIDER: { props: { line: true } },
  HERO: titled("Water for Kisumu"),
  BANNER: { props: { title: "Quarterly update" } },
  KEY_MESSAGES: { props: { messages: [{ text: "Boreholes now serve more homes." }, { text: "  " }] } },
  QUOTE: { props: { text: "The water is close now.", attribution: "A mother in Kisumu", consentConfirmed: false } },
  CALLOUT: { props: { text: "Rains delayed two sites.", tone: "warn" } },
  LEGEND_NOTES: { props: { notes: ["Figures to March 2026.", ""] } },
  KPI: { props: { indicatorId: "a", includeDraft: false }, data: { sheet: SAMPLE_SHEET } },
  BIG_NUMBERS: withFacts({ numbers: [{ label: "People reached", source: "REACH_UNIQUE" }, { label: "Indicator a", source: "INDICATOR", indicatorId: "a" }, { label: "Budget", source: "FINANCE_BUDGET" }, { label: "Not recorded", source: "INDICATOR", indicatorId: "zz" }] }),
  METRIC: { props: { metric: "ACTIVITIES_TOTAL" }, data: { plan: [plan("DONE", "DONE"), plan("IN_PROGRESS", "LATE")] } },
  PROGRESS_RINGS: withFacts({}),
  CHART: { props: { spec: chartSpec }, data: dataset(["a"]) },
  SMALL_MULTIPLES: withFacts({ title: "By indicator" }),
  MAP: { props: { view: "RESULTS" }, data: { places: [{ name: "Kisumu", path: "Kisumu › Kenya", level: 1, value: 25, partly: false, latitude: -0.09, longitude: 34.76 }, { name: "Siaya", path: "Siaya › Kenya", level: 1, value: null, partly: false }] } },
  LOCATION_RESULTS: withFacts({}),
  LOCATION_COMPARISON: withFacts({}),
  ACTIVITIES_BY_LOCATION: withFacts({}),
  TABLE: { props: { query: tableQuery }, data: dataset(["a"]) },
  PROJECT_LIST: { props: { affiliation: "ALL" }, data: { projects: [{ projectId: "p1", title: "Water for Kisumu", status: "ACTIVE", sector: "WASH", country: "Kenya", donorName: "EU" }], userId: "u1" } },
  FUNNEL: withFacts({ stages: [{ label: "In need", value: 1000, sourceNote: "Needs assessment" }, { label: "Reached", bind: "REACH_UNIQUE" }] }),
  FUNDING: withFacts({}),
  RESULTS_CHAIN: withFacts({ title: "Results chain" }),
  SECTOR_GRID: withFacts({ sectors: [{ label: "Water", indicatorIds: ["a", "zz"] }] }),
  TIMELINE: { props: { events: [{ date: "2026-01-15", label: "Boreholes drilled" }] } },
  THREE_W: { props: { presence: [{ who: "Water NGO", what: "Drilling", where: ["Kisumu", " "] }], caption: "Partner list, March 2026" } },
  DEMOGRAPHICS: withFacts({}),
  REACH: withFacts({}),
  PORTFOLIO_SUMMARY: portfolioFixture("Portfolio"),
  PORTFOLIO_TABLE: portfolioFixture("Projects"),
  PORTFOLIO_HEALTH: portfolioFixture("Health"),
  PORTFOLIO_COUNTRIES: portfolioFixture("Countries"),
  IMAGE: { props: { title: "Distribution day", assetId: "asset-1", altText: "People queue at a new borehole.", consentConfirmed: true } },
  AI_SUMMARY: { props: {}, data: { text: "Two boreholes opened.", accepted: false } },
  AI_MESSAGES: { props: {}, data: { text: "Rains delayed two sites.", accepted: true } },
  AI_ASK: { props: {} },
  GROUP: { props: { title: "Water" } },
  TABS: { props: { titles: ["Results", "Plan"] } },
  REPEATER: { props: { over: "PROJECT", limit: 6 } },
  FILTER_BAR: { props: { dimensions: ["PERIOD"] } },
};
