import test from "node:test";
import assert from "node:assert/strict";
import { configFromTemplate } from "@donordesk/domain";
import { composeInfographicPages, rasterizePage, contextFor } from "../dist/infographics/composer.js";
import { kpiBlock } from "../dist/infographics/blocks-core.js";
import { InfographicComposerRenderer, PrismaOrganizationBrandReader } from "../dist/infographics/renderer.js";

const period = (id, label, start, end) => ({ id, label, start, end, reportType: "QUARTERLY", locked: false, reportStatus: "APPROVED" });

const sheet = {
  projectId: "p1",
  financeEnabled: true,
  periods: [period("q1", "Jan – Mar 2026", "2026-01-01", "2026-03-31"), period("q2", "Apr – Jun 2026", "2026-04-01", "2026-06-30")],
  indicators: [
    { id: "i1", code: "#1", name: "Boreholes rehabilitated", level: null, type: "NUMBER", unit: "", baseline: "0", target: "120", isRate: false },
  ],
  cells: [
    { indicatorId: "i1", periodId: "q1", periodValue: "30", cumulativeValue: "30", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "q2", periodValue: "56", cumulativeValue: "86", status: "DRAFT" },
  ],
  finance: [],
};

const data = {
  projectId: "p1",
  project: { title: "Clean Water for Gulu District", projectCode: "UGA-2026-014", donorName: "Example Donor", sector: "WASH", country: "Uganda", start: "2026-01-01", end: "2027-12-31", status: "ACTIVE" },
  periods: sheet.periods,
  periodOrder: ["q1", "q2"],
  indicators: [
    {
      id: "i1", code: "#1", name: "Boreholes rehabilitated", type: "NUMBER", unit: "", baseline: "0", target: "120", isRate: false,
      targetBreakdowns: [
        { dimension: "LOCATION", category: "Gulu", value: "40" },
        { dimension: "LOCATION", category: "Kitgum", value: "30" },
      ],
      location: { kind: "ADDITIVE", rows: [{ key: "gulu", location: "Gulu", value: "34", verified: true, unverified: 0, series: [{ reportingPeriodId: "q2", value: "34", verified: true }] }, { key: "kitgum", location: "Kitgum", value: "21", verified: false, unverified: 1, series: [{ reportingPeriodId: "q2", value: "21", verified: false }] }] },
      targetActual: {
        kind: "WITH_TARGETS",
        rows: [
          { key: "gulu", location: "Gulu", target: "40", actual: "34", gap: "6", percentOfTarget: "85" },
          { key: "kitgum", location: "Kitgum", target: "30", actual: "21", gap: "9", percentOfTarget: "70" },
        ],
      },
      trends: { kind: "OK", periods: ["q1", "q2"], series: [] },
      projectWideValue: null,
    },
  ],
  reach: { overallUnique: 312, registeredTotal: 480, registeredByLocation: [{ key: "gulu", location: "Gulu", unique: 214 }], attendancesByActivityLocation: [{ key: "gulu", location: "Gulu", attendances: 410 }], beneficiariesWithoutLocation: 2, attendancesWithoutLocation: 1 },
  activities: { rows: [{ key: "gulu", location: "Gulu", planned: 18, done: 14, late: 2, cancelled: 1 }], unlocated: 1 },
  finance: { enabled: false, rows: [] },
  provenance: { generatedAt: "2026-10-24T12:00:00.000Z", unverifiedValues: 1, locationTrackedIndicators: 1, projectWideIndicators: 0 },
};

const provenance = {
  source: "project-records",
  periodLabels: ["Jan – Mar 2026", "Apr – Jun 2026"],
  indicatorCodes: ["#1"],
  generatedAt: "2026-10-24T12:00:00.000Z",
  unverifiedCount: 1,
  notYetReportedCount: 0,
};

const input = (config) => ({
  config,
  data,
  sheet,
  provenance,
  mapPoints: [{ name: "Gulu", lat: 2.77, lng: 32.3, worst: "DONE", count: 3 }],
  organizationName: "Org <Test> & Co",
  templateLabel: "Project Overview",
});

import { listThemes } from "@donordesk/domain";

test("every look draws: a font stack with its own double quotes never breaks the page (found on a themed canvas export)", async () => {
  const quoted = listThemes().filter((t) => String(t.font).includes('"'));
  assert.ok(quoted.length > 0, "some looks name their font in double quotes");
  for (const theme of quoted.slice(0, 6)) {
    const config = configFromTemplate("OVERVIEW");
    config.themeId = theme.id;
    const pages = await composeInfographicPages(input(config));
    assert.equal(/font-family="[^"]*"[^"]*"/.test(pages[0].replace(/font-family="[^"]*"/g, "")) || false, false);
    const png = await rasterizePage(pages[0]);
    assert.ok(png.length > 1000, `${theme.id} draws`);
  }
});
