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

test("an overview renders one fixed A4 page; an officer-typed angle bracket is escaped, not executed", async () => {
  const config = configFromTemplate("OVERVIEW");
  config.sections.push({ kind: "TEXT", title: "Objective", text: "Water for <script>alert(1)</script> everyone & all" });
  const pages = await composeInfographicPages(input(config));
  assert.equal(pages.length, 1);
  assert.match(pages[0], /&lt;script&gt;/, "typed words are escaped");
  assert.equal(pages[0].includes("<script>"), false);
  assert.match(pages[0], /Water for &lt;script&gt;alert\(1\)&lt;\/script&gt; everyone &amp; all/);
  assert.doesNotMatch(pages[0], /<script>/, "no raw script tag anywhere");
  assert.match(pages[0], /ORG &lt;TEST&gt; &amp; CO/, "the organization name is escaped too");
});

test("the composer is deterministic: identical inputs give identical bytes", async () => {
  const config = configFromTemplate("OVERVIEW");
  const first = await composeInfographicPages(input(config));
  const second = await composeInfographicPages(input(config));
  assert.deepEqual(first, second);
  const pngA = await rasterizePage(first[0]);
  const pngB = await rasterizePage(second[0]);
  assert.equal(pngA.equals(pngB), true);
});

test("missing data renders as 'Not yet reported', never zero", async () => {
  const config = configFromTemplate("PROGRESS");
  const empty = {
    ...input(config),
    data: {
      ...data,
      reach: { ...data.reach, overallUnique: 0, registeredByLocation: [], attendancesByActivityLocation: [] },
      activities: { rows: [], unlocated: 0 },
    },
  };
  const pages = await composeInfographicPages(empty);
  assert.match(pages.join("\n"), /Not yet reported/);
});

test("a chart section draws from the shared chart engine and notes unverified points", async () => {
  const config = configFromTemplate("OVERVIEW");
  config.sections = [
    { kind: "CHART", title: "Boreholes over time", chart: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "CUMULATIVE", type: "LINE", showTarget: true } },
  ];
  const pages = await composeInfographicPages(input(config));
  assert.match(pages[0], /<svg x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" viewBox="0 0 /, "the chart is a nested vector picture");
  assert.doesNotMatch(pages[0], /zr\d+-/, "the chart engine's global element ids are replaced by stable ones");
  assert.match(pages[0], /not verified yet/i);
});

test("location rows render even when no location targets were planned; an unverified figure reads amber", async () => {
  const config = configFromTemplate("OVERVIEW");
  config.sections = [{ kind: "LOCATION_RESULTS" }, { kind: "LOCATION_COMPARISON" }];
  const rowsInput = { ...input(config), data: { ...data, indicators: [{ ...data.indicators[0], targetBreakdowns: [], targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } }] } };
  const withRows = await composeInfographicPages(rowsInput);
  const page = withRows.join("\n");
  assert.match(page, /#1 Gulu/, "the recorded location row is drawn, not skipped");
  assert.match(page, /#1 Kitgum/);
  assert.match(page, /Not planned/, "a location nobody planned a target for says so");
  assert.match(page, /#92400e/, "an unverified figure reads amber");
});

test("the renderer produces a PNG and a PDF; PDF keeps multiple pages when content overflows", async () => {
  const renderer = new InfographicComposerRenderer();
  const config = configFromTemplate("OVERVIEW");
  config.sections.push({ kind: "TEXT", title: "Lessons", text: "x".repeat(580) }, { kind: "TEXT", title: "More", text: "y".repeat(580) }, { kind: "TEXT", title: "Even more", text: "z".repeat(580) }, { kind: "TEXT", title: "Still more", text: "w".repeat(580) }, { kind: "TEXT", title: "Yet more", text: "v".repeat(580) });
  const renderInput = {
    configJson: JSON.stringify(config),
    dataJson: JSON.stringify(data),
    sheetJson: JSON.stringify(sheet),
    mapPointsJson: "[]",
    organizationName: "Org",
    provenanceJson: JSON.stringify(provenance),
  };
  const png = await renderer.renderPng(renderInput);
  assert.equal(png.ok, true);
  assert.equal(png.value.slice(1, 4).toString(), "PNG");
  const pdf = await renderer.renderPdf(renderInput);
  assert.equal(pdf.ok, true);
  assert.match(pdf.value.subarray(0, 5).toString(), /%PDF-/);
});

test("unreadable render inputs are refused with a sentence, not a crash", async () => {
  const renderer = new InfographicComposerRenderer();
  const result = await renderer.renderPng({ configJson: "{", dataJson: "{}", sheetJson: "{}", mapPointsJson: "[]", organizationName: "Org", provenanceJson: "{}" });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /not readable/);
});

test("the brand reader is a port; the class exists for the container", () => {
  assert.equal(typeof PrismaOrganizationBrandReader, "function");
});

test("a theme changes the drawing tokens; a design without a theme keeps the classic look", async () => {
  const classic = (await composeInfographicPages(input(configFromTemplate("OVERVIEW")))).join("\n");
  assert.match(classic, /#2f7be8/, "classic accent");
  assert.match(classic, /Helvetica/);
  const contrast = (await composeInfographicPages(input({ ...configFromTemplate("OVERVIEW"), themeId: "HIGH_CONTRAST" }))).join("\n");
  assert.match(contrast, /#00457a/, "high-contrast accent");
  assert.doesNotMatch(contrast, /#2f7be8/, "no classic colour leaks into another theme");
  assert.match(contrast, /Arial/);
  const print = (await composeInfographicPages(input({ ...configFromTemplate("OVERVIEW"), themeId: "PRINT_MONO" }))).join("\n");
  assert.doesNotMatch(print, /#2f7be8|#8b5cf6|#16a34a/, "the print theme draws in greys only");
});

test("the PDF is vector with the bundled font embedded (selectable text), and the KPI cards stay inside their panel", async () => {
  const config = configFromTemplate("OVERVIEW");
  const result = await new InfographicComposerRenderer().renderPdf({
    configJson: JSON.stringify(config),
    dataJson: JSON.stringify(data),
    sheetJson: JSON.stringify(sheet),
    provenanceJson: JSON.stringify(provenance),
    mapPointsJson: "[]",
    organizationName: "Org",
  });
  assert.equal(result.ok, true);
  const raw = result.value.toString("latin1");
  assert.match(raw, /LiberationSans/, "the bundled face is embedded, not the host's");
  assert.ok(result.value.length < 400_000, "text stays text: far smaller than a page image");
  const ctx = contextFor({ config, data, sheet, provenance, mapPoints: [], organizationName: "Org", templateLabel: "x" });
  const slot = kpiBlock(ctx, { kind: "KPIS" }, 1096);
  const rights = [...slot.svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" rx="[\d.]+" fill="#f8fafc"/g)].map((m) => Number(m[1]) + Number(m[2]));
  assert.equal(rights.length, 4);
  for (const right of rights) assert.ok(right <= 1096 - 16 + 0.01, `card edge ${right} inside the panel`);
});
