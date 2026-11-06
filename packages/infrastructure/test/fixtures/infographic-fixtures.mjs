import { svgToPng } from "../../dist/infographics/raster.js";

const period = (id, label, start, end) => ({ id, label, start, end, reportType: "QUARTERLY", locked: false, reportStatus: "APPROVED" });

export const sheet = {
  projectId: "p1",
  financeEnabled: true,
  periods: [period("q1", "Jan – Mar 2026", "2026-01-01", "2026-03-31"), period("q2", "Apr – Jun 2026", "2026-04-01", "2026-06-30"), period("q3", "Jul – Sep 2026", "2026-07-01", "2026-09-30")],
  indicators: [
    { id: "i1", code: "#1", name: "Boreholes rehabilitated", level: "OUTPUT", type: "NUMBER", unit: "", baseline: "0", target: "120", isRate: false },
    { id: "i2", code: "#2", name: "People with access to safe water", level: "OUTCOME", type: "NUMBER", unit: "", baseline: "0", target: "30000", isRate: false },
    { id: "i3", code: "#3", name: "Households using latrines", level: "OUTCOME", type: "PERCENTAGE", unit: "%", baseline: "20", target: "80", isRate: true },
    { id: "i4", code: "#4", name: "Hygiene sessions held", level: "OUTPUT", type: "NUMBER", unit: "", baseline: "0", target: "200", isRate: false },
  ],
  cells: [
    { indicatorId: "i1", periodId: "q1", periodValue: "30", cumulativeValue: "30", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "q2", periodValue: "56", cumulativeValue: "86", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "q3", periodValue: "20", cumulativeValue: "106", status: "DRAFT" },
    { indicatorId: "i2", periodId: "q1", periodValue: "4000", cumulativeValue: "4000", status: "VERIFIED" },
    { indicatorId: "i2", periodId: "q2", periodValue: "9000", cumulativeValue: "13000", status: "VERIFIED" },
    { indicatorId: "i2", periodId: "q3", periodValue: "8345", cumulativeValue: "21345", status: "VERIFIED" },
    { indicatorId: "i3", periodId: "q1", periodValue: "31", cumulativeValue: "", status: "VERIFIED" },
    { indicatorId: "i3", periodId: "q2", periodValue: "48", cumulativeValue: "", status: "VERIFIED" },
    { indicatorId: "i3", periodId: "q3", periodValue: "64", cumulativeValue: "", status: "VERIFIED" },
    { indicatorId: "i4", periodId: "q2", periodValue: "40", cumulativeValue: "40", status: "VERIFIED" },
  ],
  finance: [],
};

export const data = {
  projectId: "p1",
  project: { title: "Clean Water for Gulu District", projectCode: "UGA-2026-014", donorName: "Example Donor", sector: "WASH", country: "Uganda", start: "2026-01-01", end: "2027-12-31", status: "ACTIVE" },
  periods: sheet.periods,
  periodOrder: ["q1", "q2", "q3"],
  indicators: [
    {
      id: "i1", code: "#1", name: "Boreholes rehabilitated", type: "NUMBER", unit: "", baseline: "0", target: "120", isRate: false,
      targetBreakdowns: [{ dimension: "LOCATION", category: "Gulu", value: "40" }, { dimension: "LOCATION", category: "Kitgum", value: "30" }],
      location: { kind: "ADDITIVE", rows: [{ key: "gulu", location: "Gulu", value: "34", verified: true, unverified: 0, series: [{ reportingPeriodId: "q2", value: "34", verified: true }] }, { key: "kitgum", location: "Kitgum", value: "21", verified: false, unverified: 1, series: [{ reportingPeriodId: "q2", value: "21", verified: false }] }] },
      targetActual: { kind: "WITH_TARGETS", rows: [{ key: "gulu", location: "Gulu", target: "40", actual: "34", gap: "6", percentOfTarget: "85" }, { key: "kitgum", location: "Kitgum", target: "30", actual: "21", gap: "9", percentOfTarget: "70" }] },
      trends: { kind: "OK", periods: ["q1", "q2"], series: [] },
      projectWideValue: null,
    },
  ],
  reach: {
    overallUnique: 21345, registeredTotal: 24010,
    registeredByLocation: [{ key: "gulu", location: "Gulu", unique: 11200 }, { key: "kitgum", location: "Kitgum", unique: 6400 }, { key: "pader", location: "Pader", unique: 3745 }],
    attendancesByActivityLocation: [{ key: "gulu", location: "Gulu", attendances: 41000 }],
    beneficiariesWithoutLocation: 2, attendancesWithoutLocation: 1,
    bySex: { FEMALE: 11800, MALE: 9200, OTHER: 345 },
    byAgeGroup: { UNDER_5: 2100, AGE_5_17: 6900, AGE_18_59: 10400, AGE_60_PLUS: 1945 },
  },
  activities: { rows: [{ key: "gulu", location: "Gulu", planned: 18, done: 14, late: 2, cancelled: 1 }, { key: "kitgum", location: "Kitgum", planned: 12, done: 7, late: 0, cancelled: 0 }], unlocated: 1 },
  finance: { enabled: true, rows: [{ periodId: "q1", currency: "USD", budget: "250000", expenditure: "61000", balance: "189000", burnRatePercent: "24", verified: true }, { periodId: "q2", currency: "USD", budget: "250000", expenditure: "133000", balance: "117000", burnRatePercent: "53", verified: true }, { periodId: "q3", currency: "USD", budget: "250000", expenditure: "190000", balance: "60000", burnRatePercent: "76", verified: false }] },
  provenance: { generatedAt: "2026-10-24T12:00:00.000Z", unverifiedValues: 2, locationTrackedIndicators: 1, projectWideIndicators: 3 },
};

export const provenance = {
  source: "project-records",
  periodLabels: ["Jan – Mar 2026", "Jul – Sep 2026"],
  indicatorCodes: ["#1", "#4"],
  generatedAt: "2026-10-24T12:00:00.000Z",
  unverifiedCount: 2,
  notYetReportedCount: 0,
};

export const pins = [
  { name: "Gulu", lat: 2.77, lng: 32.3, worst: "DONE", count: 3 },
  { name: "Kitgum", lat: 3.29, lng: 32.88, worst: "LATE", count: 2 },
  { name: "Pader", lat: 2.9, lng: 33.08, worst: "ON_TIME", count: 1 },
];

/** A square gradient photo stand-in, as an embeddable asset. */
export function fakePhoto(w = 640, h = 420) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1b5e20"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${h * 0.14}" fill="#fff59d"/></svg>`;
  return { dataUri: `data:image/png;base64,${svgToPng(svg).toString("base64")}`, width: w, height: h };
}

export const gulu = [
  [32.0, 2.4], [32.7, 2.3], [33.2, 2.7], [33.1, 3.3], [32.6, 3.5], [32.1, 3.1],
];

export const richConfig = (over = {}) => ({
  templateId: "CUSTOM",
  templateVersion: 1,
  title: "Clean water reached 21,345 people in northern Uganda",
  subtitle: "Results to September 2026",
  themeId: "HUMANITARIAN_BLUE",
  format: "A4_PORTRAIT",
  profile: "DONOR_REPORT",
  acknowledgement: "With funding from Example Donor",
  sections: [
    { kind: "HERO" },
    { kind: "BIG_NUMBERS", rounding: "HUNDREDS", numbers: [{ source: "REACH_UNIQUE", label: "People reached", iconId: "people" }, { source: "ACTIVITIES_DONE", label: "Activities completed", iconId: "check" }, { source: "MANUAL", label: "People in need", value: "48,000", sourceNote: "Needs assessment, March 2026", iconId: "water" }, { source: "FINANCE_EXPENDITURE", label: "Verified spend", iconId: "coin" }] },
    { kind: "FUNNEL", stages: [{ label: "People in need", value: 48000, sourceNote: "Needs assessment, March 2026" }, { label: "People targeted", value: 30000, sourceNote: "Response plan" }, { label: "People reached", bind: "REACH_UNIQUE" }] },
    { kind: "KEY_MESSAGES", span: 6, messages: [{ text: "Water points now serve 21,345 people." }, { text: "Latrine use rose from 31% to 64% in nine months.", iconId: "health" }, { text: "Two locations need more support to meet their targets." }] },
    { kind: "DEMOGRAPHICS", span: 6 },
    { kind: "PROGRESS_RINGS", indicatorIds: ["i1", "i2", "i3", "i4"] },
    { kind: "MAP", span: 6 },
    { kind: "SECTOR_GRID", span: 6, sectors: [{ label: "Water", iconId: "water", indicatorIds: ["i1", "i2"] }, { label: "Sanitation", iconId: "health", indicatorIds: ["i3"] }] },
    { kind: "TIMELINE", events: [{ date: "2026-01-15", label: "Project start", detail: "Teams deployed to Gulu" }, { date: "2026-04-02", label: "First 50 boreholes working" }, { date: "2026-08-20", label: "Kitgum site opened", detail: "Delayed by rains" }, { date: "2026-09-30", label: "Mid-term review" }] },
    { kind: "QUOTE", text: "We no longer walk two hours for water. The children are in school.", attribution: "Community leader, Gulu" },
    { kind: "FUNDING" },
    { kind: "SMALL_MULTIPLES" },
    { kind: "TABLE" },
    { kind: "RESULTS_CHAIN" },
    { kind: "LEGEND_NOTES", notes: ["Figures to 30 September 2026.", "Latrine use is a survey rate."] },
  ],
  ...over,
});
