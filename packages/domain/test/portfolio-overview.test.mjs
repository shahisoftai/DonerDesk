import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioRow, rankPortfolio, portfolioTotals } from "../dist/index.js";

const today = "2026-10-21";
const health = (band, over = {}) => ({ band, label: band, reasons: ["r1", "r2"], lateActivities: 0, valuesOverdue: 0, ...over });
const facts = (over = {}) => ({ projectId: "p", title: "Alpha", donorName: "D", country: "KE", status: "ACTIVE", health: health("ON_TRACK"), risks: [], periods: [], ...over });

test("a row names the delivery reason, counts open risks and finds the next unfinished report", () => {
  const row = buildPortfolioRow(facts({
    health: health("OFF_TRACK", { lateActivities: 3, valuesOverdue: 2 }),
    risks: [
      { status: "OPEN", seriousness: "HIGH", reviewBy: "2026-10-01" },
      { status: "OPEN", seriousness: "LOW" },
      { status: "CLOSED", seriousness: "HIGH", reviewBy: "2026-09-01" },
    ],
    periods: [
      { id: "a", deadline: "2026-09-30", status: "APPROVED", readinessScore: 100, cancelled: false },
      { id: "b", deadline: "2026-10-18", status: "DRAFT_GENERATED", readinessScore: 40, cancelled: false },
      { id: "c", deadline: "2026-11-30", status: "NOT_STARTED", readinessScore: 0, cancelled: false },
      { id: "d", deadline: "2026-10-01", status: "NOT_STARTED", readinessScore: 0, cancelled: true },
    ],
  }), today);
  assert.equal(row.delivery.reason, "r1");
  assert.deepEqual(row.risks, { open: 2, high: 1, reviewOverdue: 1 });
  assert.deepEqual(row.reporting, { periodId: "b", deadline: "2026-10-18", daysUntil: -3, status: "DRAFT_GENERATED", readinessScore: 40 });
  assert.equal(row.reportsOverdue, 1);
});

test("a project with no periods and no risks has no reporting line and zero counts", () => {
  const row = buildPortfolioRow(facts(), today);
  assert.equal(row.reporting, null);
  assert.deepEqual(row.risks, { open: 0, high: 0, reviewOverdue: 0 });
  assert.equal(row.reportsOverdue, 0);
});

test("ranking puts behind projects first, then overdue reports, serious problems and the nearest report", () => {
  const mk = (title, band, extra = {}) => buildPortfolioRow(facts({ title, health: health(band), ...extra }), today);
  const rows = [
    mk("Zeta", "ON_TRACK"),
    mk("Beta", "AT_RISK"),
    mk("Alpha", "OFF_TRACK"),
    mk("Gamma", "ON_TRACK", { risks: [{ status: "OPEN", seriousness: "HIGH" }] }),
    mk("Delta", "ON_TRACK", { periods: [{ id: "x", deadline: "2026-10-10", status: "NOT_STARTED", readinessScore: 0, cancelled: false }] }),
  ];
  assert.deepEqual(rankPortfolio(rows).map((r) => r.title), ["Alpha", "Beta", "Delta", "Gamma", "Zeta"]);
});

test("totals add up the rows and invent no combined score", () => {
  const rows = [
    buildPortfolioRow(facts({ health: health("OFF_TRACK"), risks: [{ status: "OPEN", seriousness: "HIGH" }] }), today),
    buildPortfolioRow(facts({ title: "B", health: health("AT_RISK"), risks: [{ status: "OPEN", seriousness: "LOW" }] }), today),
  ];
  assert.deepEqual(portfolioTotals(rows), { projects: 2, behind: 1, needAttention: 1, openRisks: 2, highRisks: 1, reportsOverdue: 0 });
});
