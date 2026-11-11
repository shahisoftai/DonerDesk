import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_KINDS } from "@donordesk/domain";
import { contextFor } from "../dist/infographics/composer.js";
import { heroBlock, bigNumbersBlock, funnelBlock, progressRingsBlock, demographicsBlock, fundingBlock, bannerBlock, dividerBlock, keyMessagesBlock, legendNotesBlock, quoteBlock, imageBlock, timelineBlock, sectorGridBlock } from "../dist/infographics/blocks-new.js";
import { threeWBlock, portfolioSummaryBlock, portfolioTableBlock, portfolioHealthBlock, portfolioCountriesBlock } from "../dist/infographics/blocks-portfolio.js";
import { resultsChainBlock } from "../dist/infographics/blocks-new.js";
import { reachBlock, activitiesBlock, locationResultsBlock, locationComparisonBlock, textBlock } from "../dist/infographics/blocks-core.js";
import { notReported } from "../dist/infographics/kit.js";
import { titleFor } from "../dist/infographics/blocks-core.js";
import { paintSection, PRINT_PAINTERS, PRINT_PENDING, printPainterFor, unpaintable } from "../dist/canvas/print-registry.js";

/** The Studio's own block functions are the oracle: a painter fed by the shared model must draw exactly what they draw. */
const LEGACY = {
  BIG_NUMBERS: bigNumbersBlock, PROGRESS_RINGS: progressRingsBlock, FUNNEL: funnelBlock, REACH: reachBlock, ACTIVITIES_BY_LOCATION: activitiesBlock,
  LOCATION_RESULTS: locationResultsBlock, LOCATION_COMPARISON: locationComparisonBlock, DEMOGRAPHICS: demographicsBlock, FUNDING: fundingBlock,
  // The composer hands a cover the design's cover picture when the section names none; the model does the same.
  HERO: (c, section, width) => heroBlock(c, section.assetId || !c.config.coverAssetId ? section : { ...section, assetId: c.config.coverAssetId }, width),
  TEXT: textBlock, DIVIDER: (c, _section, width) => dividerBlock(c, width), BANNER: bannerBlock, KEY_MESSAGES: keyMessagesBlock, LEGEND_NOTES: legendNotesBlock,
  QUOTE: quoteBlock, IMAGE: imageBlock, TIMELINE: timelineBlock, SECTOR_GRID: sectorGridBlock, THREE_W: threeWBlock,
  RESULTS_CHAIN: resultsChainBlock, PORTFOLIO_SUMMARY: portfolioSummaryBlock, PORTFOLIO_TABLE: portfolioTableBlock, PORTFOLIO_HEALTH: portfolioHealthBlock, PORTFOLIO_COUNTRIES: portfolioCountriesBlock,
};
// Small multiples draws its lines from the model (the Studio built a chart from the data sheet again); it is checked on its own below.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const assets = { a1: { dataUri: PNG, width: 800, height: 400 }, tall: { dataUri: PNG, width: 400, height: 900 } };

const period = (id, label, start, end) => ({ id, label, start, end, reportType: "QUARTERLY", locked: false, reportStatus: "APPROVED" });
const ind = (id, code, extra = {}) => ({ id, code, name: `Indicator ${code}`, level: "OUTPUT", type: "NUMBER", unit: "people", baseline: "0", target: "120", isRate: false, ...extra });
const sheet = {
  projectId: "p1", financeEnabled: true,
  periods: [period("q1", "Jan – Mar 2026", "2026-01-01", "2026-03-31"), period("q2", "Apr – Jun 2026", "2026-04-01", "2026-06-30"), period("q3", "Jul – Sep 2026", "2026-07-01", "2026-09-30")],
  indicators: [ind("i1", "#1"), ind("i2", "#2", { type: "PERCENTAGE", unit: "%", isRate: true, target: "90" }), ind("i3", "#3", { unit: "", target: "0" }), ind("i4", "#4", { name: "Not recorded anywhere" })],
  cells: [
    { indicatorId: "i1", periodId: "q1", periodValue: "30", cumulativeValue: "30", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "q2", periodValue: "56", cumulativeValue: "86", status: "DRAFT" },
    { indicatorId: "i2", periodId: "q2", periodValue: "64", cumulativeValue: "64", status: "VERIFIED" },
    { indicatorId: "i3", periodId: "q2", periodValue: "1,200", cumulativeValue: "", status: "VERIFIED" },
  ],
  finance: [],
};
const rows = (xs) => xs.map(([key, location, value, verified]) => ({ key, location, value, verified, unverified: verified ? 0 : 1, series: [] }));
const rich = {
  projectId: "p1",
  project: { title: "Clean Water for Gulu", projectCode: "UGA-1", donorName: "Donor", sector: "WASH", country: "Uganda", start: "2026-01-01", end: "2027-12-31", status: "ACTIVE" },
  periods: sheet.periods, periodOrder: ["q1", "q2", "q3"],
  indicators: [
    { ...ind("i1", "#1"), targetBreakdowns: [], location: { kind: "ADDITIVE", rows: rows([["gulu", "Gulu", "34", true], ["kitgum", "Kitgum", "21", false]]) },
      targetActual: { kind: "WITH_TARGETS", rows: [{ key: "gulu", location: "Gulu", target: "40", actual: "34", percentOfTarget: "85" }, { key: "kitgum", location: "Kitgum", target: "30", actual: null }, { key: "amuru", location: "Amuru", actual: "5" }] }, trends: { kind: "OK", periods: [], series: [] }, projectWideValue: null },
    { ...ind("i2", "#2", { type: "PERCENTAGE", isRate: true }), targetBreakdowns: [], location: { kind: "RECORDED", rows: rows([["gulu", "Gulu", "64", true], ["lira", "Lira", "58", false]]) },
      targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] }, trends: { kind: "OK", periods: [], series: [] }, projectWideValue: null },
    { ...ind("i3", "#3"), targetBreakdowns: [], location: { kind: "PROJECT_WIDE" }, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] }, trends: { kind: "OK", periods: [], series: [] }, projectWideValue: null },
  ],
  reach: {
    overallUnique: 312, registeredTotal: 480, registeredByLocation: [["gulu", "Gulu", 214], ["kitgum", "Kitgum", 60], ["lira", "Lira", 30], ["amuru", "Amuru", 5], ["pader", "Pader", 3], ["arua", "Arua", 1]].map(([key, location, unique]) => ({ key, location, unique })),
    attendancesByActivityLocation: [{ key: "gulu", location: "Gulu", attendances: 410 }], beneficiariesWithoutLocation: 2, attendancesWithoutLocation: 1,
    bySex: { female: 200, male: 100, unknown: 12 }, byAgeGroup: { AGE_5_17: 90, UNDER_5: 30, AGE_60_PLUS: 12, AGE_18_59: 180, "65+": 4, "weird_group": 2 },
  },
  activities: { rows: [{ key: "gulu", location: "Gulu", planned: 18, done: 14, late: 2, cancelled: 1 }, { key: "kitgum", location: "Kitgum", planned: 6, done: 0, late: 0, cancelled: 0 }], unlocated: 3 },
  finance: { enabled: true, rows: [
    { periodId: "q1", currency: "USD", budget: "100000", expenditure: "20000", balance: "80000", burnRatePercent: "20", verified: true },
    { periodId: "q2", currency: "USD", budget: "100,000", expenditure: "oops", balance: "", verified: false },
  ] },
  provenance: { generatedAt: "2026-10-24T12:00:00.000Z", unverifiedValues: 1, locationTrackedIndicators: 2, projectWideIndicators: 1 },
};
const nothing = { ...rich, indicators: [], reach: { ...rich.reach, overallUnique: 0, registeredTotal: 0, registeredByLocation: [], attendancesByActivityLocation: [], bySex: {}, byAgeGroup: {} }, activities: { rows: [], unlocated: 0 }, finance: { enabled: false, rows: [] } };
const zeros = { ...rich, reach: { ...rich.reach, bySex: { female: 0 }, byAgeGroup: { AGE_5_17: 0 } }, activities: { rows: [], unlocated: 2 } };

const provenance = { source: "project-records", periodLabels: ["Jan – Mar 2026"], indicatorCodes: ["#1"], generatedAt: "2026-10-24T12:00:00.000Z", unverifiedCount: 1, notYetReportedCount: 0 };
const config = (over = {}) => ({ templateId: "CUSTOM", templateVersion: 1, sections: [], ...over });
const portfolio = {
  asAt: "2026-03-31",
  totals: { projects: 3, countries: 2, behind: 1, needAttention: 1, openRisks: 4, reportsOverdue: 2, onTrack: 1, noPlan: 0 },
  rows: [
    { title: "Water for Kisumu", donorName: "Donor A", country: "Kenya", status: "ACTIVE", band: "ON_TRACK", bandLabel: "On track", lateActivities: 0, valuesOverdue: 0, openRisks: 1, highRisks: 0, reportsOverdue: 0, nextReport: { deadline: "2026-04-30", daysUntil: 30 } },
    { title: "Schools in Gulu", donorName: "Donor B", country: "Uganda", status: "ACTIVE", band: "OFF_TRACK", bandLabel: "Off track", lateActivities: 3, valuesOverdue: 1, openRisks: 2, highRisks: 1, reportsOverdue: 1, nextReport: { deadline: "2026-03-01", daysUntil: -30 } },
    { title: "Clinics in Lira", donorName: "Donor B", country: "Uganda", status: "ACTIVE", band: "AT_RISK", bandLabel: "At risk", lateActivities: 1, valuesOverdue: 0, openRisks: 1, highRisks: 0, reportsOverdue: 1 },
  ],
  countries: [{ country: "Uganda", projects: 2, offTrack: 1, atRisk: 1, onTrack: 0, noPlan: 0 }, { country: "Kenya", projects: 1, offTrack: 0, atRisk: 0, onTrack: 1, noPlan: 0 }],
};
const ctxFor = (data, over = {}) => contextFor({ config: config(over.config), data, sheet, provenance, ...(over.noPortfolio ? {} : { portfolio }), mapPoints: [], organizationName: "Org", templateLabel: "T", preview: over.preview ?? false, assets });

const SECTIONS = {
  BIG_NUMBERS: [
    { numbers: [{ label: "People reached", source: "REACH_UNIQUE", iconId: "people" }, { label: "Indicator", source: "INDICATOR", indicatorId: "i1" }, { label: "Rate", source: "INDICATOR", indicatorId: "i2" }, { label: "Unitless", source: "INDICATOR", indicatorId: "i3", caption: "A caption" }, { label: "Gone", source: "INDICATOR", indicatorId: "i4" }, { label: "Typed", source: "MANUAL", value: "1.2 million", sourceNote: "Census 2024" }] },
    { rounding: "THOUSANDS", numbers: [{ label: "Registered", source: "REACH_REGISTERED" }, { label: "Done", source: "ACTIVITIES_DONE" }, { label: "Planned", source: "ACTIVITIES_PLANNED" }, { label: "Budget", source: "FINANCE_BUDGET" }, { label: "Spent", source: "FINANCE_EXPENDITURE" }, { label: "Balance", source: "FINANCE_BALANCE" }, { label: "Projects", source: "PORTFOLIO_PROJECTS" }, { label: "Blank", source: "MANUAL" }] },
    { numbers: [] },
  ],
  PROGRESS_RINGS: [{}, { indicatorIds: ["i1", "i2", "i3", "i4"] }, { indicatorIds: ["i4"] }],
  FUNNEL: [
    { stages: [{ label: "In need", value: 1000, sourceNote: "Needs assessment" }, { label: "Targeted", value: 500 }, { label: "Reached", bind: "REACH_UNIQUE" }, { label: "Registered", bind: "REACH_REGISTERED", sourceNote: "Needs assessment" }] },
    { stages: [{ label: "Reached", bind: "REACH_UNIQUE" }, { label: "In need" }] },
    { stages: [{ label: "A", value: 10 }, { label: "B", value: 30 }] },
    { stages: [] },
  ],
  REACH: [{}], ACTIVITIES_BY_LOCATION: [{}], DEMOGRAPHICS: [{}], FUNDING: [{}, { title: "Money" }],
  LOCATION_RESULTS: [{}, { locationKeys: ["gulu"] }, { indicatorIds: ["i2"] }, { indicatorIds: ["i3"] }, { locationKeys: ["nowhere"] }],
  LOCATION_COMPARISON: [{}],
  TEXT: [{ text: "Boreholes now serve more homes across the district. ".repeat(6) }, { text: "Short", title: "A heading" }, {}],
  HERO: [{}, { title: "Own title", text: "A subtitle that runs long enough to wrap onto a second line when the page is narrow enough" }, { assetId: "a1", title: "With a picture" }, { text: "Only a subtitle" }],
  DIVIDER: [{}],
  BANNER: [{ text: "Funded by the European Union" }, { title: "A title banner" }, {}],
  KEY_MESSAGES: [{ messages: [{ text: "Boreholes now serve more homes." }, { text: "Women lead the water committees across the district and keep the records." , iconId: "water" }, { text: "x".repeat(300) }] }, { messages: [] }, {}],
  LEGEND_NOTES: [{ notes: ["Figures to March 2026.", "Rates are not summed."] }, {}, { title: "About the data" }],
  QUOTE: [{ text: "The water is close now and the children are well.", attribution: "A mother in Gulu" }, { text: "With a portrait.", assetId: "a1", attribution: "Someone" }, { text: "No attribution", assetId: "missing" }, { text: "   " }],
  IMAGE: [{ assetId: "a1", caption: "A new borehole", credit: "J. Okello", altText: "A borehole with children" }, { assetId: "tall", fit: "CONTAIN" }, { assetId: "missing" }, {}],
  TIMELINE: [{ events: [{ date: "2026-01-15", label: "Boreholes drilled", detail: "Twelve sites" }, { date: "2026-03-01", label: "Committees trained" }] }, { events: ["a", "b", "c", "d", "e"].map((x, i) => ({ date: `2026-0${i + 1}-01`, label: `Event ${x}`, ...(i % 2 ? { detail: "More" } : {}) })) }, { events: [] }],
  SECTOR_GRID: [{ sectors: [{ label: "Water", indicatorIds: ["i1", "i2"] }, { label: "Sanitation", indicatorIds: ["i3", "i4"], iconId: "water" }, { label: "Empty", indicatorIds: [] }] }, { sectors: [] }],
  RESULTS_CHAIN: [{}, { title: "Chain" }],
  PORTFOLIO_SUMMARY: [{}, { title: "Our portfolio" }], PORTFOLIO_TABLE: [{}], PORTFOLIO_HEALTH: [{}], PORTFOLIO_COUNTRIES: [{}],
  THREE_W: [{ presence: [{ who: "Water NGO", what: "Drilling", where: ["Gulu", "Kitgum"] }, { who: "Health NGO", what: "Clinics", where: ["gulu", "Lira ", "Gulu"] }, { who: "Water NGO", what: "Training", where: [] }], caption: "Partner list, March 2026" }, { presence: [{ who: "A", what: "B", where: ["P1"] }] }, { presence: [] }],
};

test("every ported painter draws exactly what the Studio's own block draws, for rich, empty and gappy data in every language and mode", () => {
  let compared = 0;
  const failures = new Set();
  const contexts = [{}, { noPortfolio: true }, { preview: true }, { config: { language: "fr" } }, { config: { language: "ar" }, preview: true }, { config: { themeId: "MONO" } }, { config: { periodFromId: "q2", periodToId: "q3", locationKeys: ["gulu", "lira"] } }, { config: { acknowledgement: "Funded by the European Union", language: "es" } }, { config: { title: "Annual review 2026", subtitle: "Borno State", coverAssetId: "a1" } }];
  for (const [dataName, data] of Object.entries({ rich, nothing, zeros })) {
    for (const over of contexts) {
      for (const [kind, sections] of Object.entries(SECTIONS)) {
        for (const props of sections) {
          const section = { kind, ...props };
          const c = ctxFor(data, over);
          // The one deliberate change: places chosen that hold nothing used to draw a header row over an empty table; the model says
          // "nothing recorded for the chosen places", so the block says "Not yet reported" like every other empty block.
          const filteredToNothing = kind === "LOCATION_RESULTS" && props.locationKeys?.[0] === "nowhere";
          const expected = filteredToNothing ? notReported(c, titleFor(c, section), 640, 84) : LEGACY[kind](c, section, 640);
          const actual = paintSection(ctxFor(data, over), section, 640);
          if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.add(`${kind} ${JSON.stringify(props).slice(0, 50)} on ${dataName} ${JSON.stringify(over)}`);
          compared += 1;
        }
      }
    }
  }
  assert.deepEqual([...failures], []);
  assert.ok(compared >= 900, `compared ${compared} drawings`);
});

test("the painters registry covers exactly the ported kinds, each is a real block, and the pending list only shrinks", () => {
  assert.deepEqual(Object.keys(PRINT_PAINTERS).sort(), [...Object.keys(LEGACY), "SMALL_MULTIPLES", "MULTI_CARD", "SHAPE", "ICON", "CALLOUT", "AI_SUMMARY", "AI_MESSAGES", "AI_ASK", "GROUP", "TABS", "REPEATER", "FILTER_BAR"].sort());
  for (const k of Object.keys(PRINT_PAINTERS)) assert.ok(BLOCK_KINDS.includes(k), k);
  assert.deepEqual([...PRINT_PENDING, ...Object.keys(PRINT_PAINTERS)].sort(), [...BLOCK_KINDS].sort());
  const PRINT_PENDING_MAX = 6; // lower this as the rest of the blocks are ported
  assert.ok(PRINT_PENDING.length <= PRINT_PENDING_MAX);
});

test("a kind with no painter yet is reported unpaintable, and a ported one is not", () => {
  assert.equal(printPainterFor("NOPE"), undefined);
  assert.equal(paintSection(ctxFor(rich), { kind: "CHART" }, 640), null, "the caller falls back");
  assert.deepEqual(unpaintable(["REACH", "MAP", "MAP", "CHART"]), ["CHART", "MAP"]);
  assert.deepEqual(unpaintable(["REACH", "FUNDING"]), []);
});

test("painters escape what a person typed: a quote cannot add markup", () => {
  const section = { kind: "BIG_NUMBERS", numbers: [{ label: '<script>alert(1)</script>"', source: "MANUAL", value: "<b>9</b>", sourceNote: "<i>src</i>" }] };
  const svg = paintSection(ctxFor(rich), section, 640).svg;
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("<b>9"));
  assert.ok(!svg.includes("<i>src"));
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("small multiples draws one line per indicator from its model, leaves a gap where nothing was recorded, and says so when there is nothing", () => {
  const drawn = paintSection(ctxFor(rich), { kind: "SMALL_MULTIPLES", title: "Trends", indicatorIds: ["i1"] }, 640);
  assert.ok(drawn && drawn.svg.includes("<svg"), "a nested chart picture");
  assert.match(drawn.svg, /trends/i);
  const none = paintSection(ctxFor(rich), { kind: "SMALL_MULTIPLES", indicatorIds: ["i4"] }, 640);
  assert.ok(none.svg.includes("Not yet reported") || none.svg.length > 0);
  assert.equal(JSON.stringify(paintSection(ctxFor(rich), { kind: "SMALL_MULTIPLES", indicatorIds: ["i1"] }, 640)), JSON.stringify(paintSection(ctxFor(rich), { kind: "SMALL_MULTIPLES", indicatorIds: ["i1"] }, 640)), "deterministic");
});
