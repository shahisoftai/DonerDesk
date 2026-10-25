import { test } from "node:test";
import assert from "node:assert/strict";
import { comparisonMatrix, kpiCards, locationResultRows, mapPoints, type InfographicData } from "../../src/features/infographics/domain/studio-view.ts";

/**
 * Phase 31 — the Studio's pure view models. Missing data is never 0 and never invented; unverified
 * is visible; reach, attendances and activities stay distinct; the map's worst signal wins.
 */

function data(overrides: Partial<InfographicData> = {}): InfographicData {
  return {
    projectId: "p1",
    project: { title: "Clean Water", projectCode: "W-001", donorName: "Donor", sector: "WASH", country: "Uganda", start: "2026-01-01", end: "2026-12-31", status: "ACTIVE" },
    periods: [{ id: "per1", label: "Jan–Jun 2026", start: "2026-01-01", end: "2026-06-30", reportType: "SEMI_ANNUAL", locked: false, reportStatus: "DRAFT" }],
    periodOrder: ["per1"],
    indicators: [],
    reach: { overallUnique: 0, registeredTotal: 0, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 0, attendancesWithoutLocation: 0, bySex: {}, byAgeGroup: {} },
    activities: { rows: [], unlocated: 0 },
    finance: { enabled: false, rows: [] },
    provenance: { generatedAt: "2026-10-25T00:00:00Z", unverifiedValues: 0, locationTrackedIndicators: 0, projectWideIndicators: 0 },
    ...overrides,
  };
}

const locatedIndicator: InfographicData["indicators"][number] = {
  id: "ind1",
  code: "OUT1.1",
  name: "People with safe water",
  type: "NUMBER",
  baseline: "0",
  target: "1000",
  isRate: false,
  targetBreakdowns: [
    { dimension: "LOCATION", category: "Gulu", value: "600" },
    { dimension: "LOCATION", category: "Kitgum", value: "400" },
  ],
  location: {
    kind: "ADDITIVE",
    rows: [
      { key: "gulu", location: "Gulu", value: "420", verified: true, unverified: 0, series: [] },
      { key: "kitgum", location: "Kitgum", value: "90", verified: false, unverified: 90, series: [] },
    ],
  },
  targetActual: {
    kind: "WITH_TARGETS",
    rows: [
      { key: "gulu", location: "Gulu", target: "600", actual: "420", gap: "180", percentOfTarget: "70" },
      { key: "kitgum", location: "Kitgum", target: "400", actual: "90", gap: "310", percentOfTarget: "23" },
    ],
  },
  trends: { kind: "NOT_COMPARABLE", reason: "Only one period has entries" },
  projectWideValue: { periodValue: "510", cumulativeValue: "510", verified: false },
};

test("empty project data reads 'Not yet reported', never 0", () => {
  const cards = kpiCards(data());
  for (const card of cards) {
    assert.notEqual(card.value, "0", card.label);
    assert.equal(card.muted, true, card.label);
  }
  assert.equal(cards[0]!.value, "Not yet reported");
  assert.equal(cards[2]!.value, "Not yet reported");
  const budget = cards.find((card) => card.label === "Budget");
  assert.equal(budget?.value, "—");
  assert.equal(budget?.detail, "Finance not recorded");
});

test("kpi cards count activities and reach, and flag what lacks a location", () => {
  const cards = kpiCards(
    data({
      reach: { overallUnique: 1200, registeredTotal: 1500, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 40, attendancesWithoutLocation: 0, bySex: {}, byAgeGroup: {} },
      activities: { rows: [{ key: "gulu", location: "Gulu", planned: 10, done: 10, late: 0, cancelled: 0 }, { key: "kitgum", location: "Kitgum", planned: 5, done: 2, late: 1, cancelled: 0 }], unlocated: 3 },
    }),
  );
  assert.equal(cards[0]!.value, "1,200");
  assert.equal(cards[0]!.detail, "40 without a recorded location");
  assert.equal(cards[1]!.value, "2");
  assert.equal(cards[2]!.value, "12 / 18");
  assert.equal(cards[2]!.detail, "3 without a location");
});

test("the budget card shows the verified balance, or says it is not verified", () => {
  const verified = kpiCards(data({ finance: { enabled: true, rows: [{ periodId: "per1", currency: "EUR", budget: "10,000", expenditure: "4,000", balance: "6,000", burnRatePercent: "40", verified: true }] } }));
  assert.match(verified.find((card) => card.label.startsWith("Balance"))!.value, /^6,000/);
  const unverified = kpiCards(data({ finance: { enabled: true, rows: [{ periodId: "per1", currency: "EUR", budget: "10,000", expenditure: "4,000", balance: "6,000", verified: false }] } }));
  assert.equal(unverified.find((card) => card.label.startsWith("Balance"))!.detail, "Not verified yet");
});

test("results rows join targets to actuals and carry the verification mark", () => {
  const rows = locationResultRows(data({ indicators: [locatedIndicator] }));
  assert.deepEqual(
    rows.map((row) => [row.location, row.target, row.actual, row.verified]),
    [
      ["Gulu", "600", "420", true],
      ["Kitgum", "400", "90", false],
    ],
  );
});

test("results rows can be narrowed by indicator and by location, and a location without a target still shows", () => {
  const all = data({ indicators: [locatedIndicator] });
  assert.equal(locationResultRows(all, ["ind1"]).length, 2);
  assert.equal(locationResultRows(all, ["other"]).length, 0);
  const gulu = locationResultRows(all, undefined, ["gulu"]);
  assert.equal(gulu.length, 1);
  assert.equal(gulu[0]!.target, "600");
  const noTargets: InfographicData["indicators"][number] = { ...locatedIndicator, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } };
  const rows = locationResultRows(data({ indicators: [noTargets] }));
  assert.deepEqual(rows.map((row) => [row.location, row.target, row.actual]), [["Gulu", undefined, "420"], ["Kitgum", undefined, "90"]]);
});

test("project-wide indicators never enter the comparison matrix; recorded cells only", () => {
  const projectWide: InfographicData["indicators"][number] = { ...locatedIndicator, id: "ind2", location: { kind: "PROJECT_WIDE" }, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } };
  const matrix = comparisonMatrix(data({ indicators: [locatedIndicator, projectWide] }));
  assert.deepEqual(matrix.indicators.map((indicator) => indicator.id), ["ind1"]);
  assert.deepEqual(matrix.locations, ["gulu", "kitgum"]);
  const kitgum = matrix.cells.filter((cell) => cell.location === "kitgum");
  assert.equal(kitgum.length, 1);
  assert.equal(kitgum[0]!.verified, false);
  assert.deepEqual(comparisonMatrix(data({ indicators: [locatedIndicator] }), ["gulu"]).locations, ["gulu"]);
});

test("the map's signal is the worst state of the location's activities", () => {
  const points = mapPoints(
    data({
      activities: {
        rows: [
          { key: "a", location: "All done", planned: 4, done: 4, late: 0, cancelled: 0 },
          { key: "b", location: "Has a late one", planned: 4, done: 2, late: 1, cancelled: 0 },
          { key: "c", location: "All cancelled", planned: 2, done: 0, late: 0, cancelled: 2 },
          { key: "d", location: "Under way", planned: 5, done: 1, late: 0, cancelled: 0 },
        ],
        unlocated: 0,
      },
    }),
  );
  assert.deepEqual(
    points.map((point) => point.signal),
    ["DONE", "LATE", "CANCELLED", "ON_TIME"],
  );
});
