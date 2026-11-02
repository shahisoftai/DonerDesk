import assert from "node:assert/strict";
import test from "node:test";
import {
  ProjectSetupProposalSchema, EditSetupProposalSchema, ApplySetupProposalSchema, SetupAreaSelectionSchema,
  SetupAssistSettingsSchema, SetupProblemSchema, SETUP_AREA_KEYS, SETUP_PROBLEM_CODES,
} from "../dist/index.js";

const proposed = (value, quote = "the quote", extra = {}) => ({
  value, sourceQuote: quote, sourceRef: { documentId: "d1", block: 0 }, confidence: "HIGH", status: "PROPOSED", ...extra,
});

const validProposal = () => ({
  facts: {
    name: proposed("WASH Gulu"), code: proposed("WG-1"), donor: proposed("EU"),
    countries: proposed(["Uganda"]), sectors: proposed(["WASH"]),
    startDate: proposed("2026-01-01"), endDate: proposed("2027-12-31"),
    currency: proposed("EUR"), summary: proposed("Water."),
  },
  logframe: [proposed({ level: "GOAL", code: null, title: "Goal", description: null, parentCode: null, codeSource: "GENERATED" })],
  indicators: [proposed({
    code: "IND-1", title: "Households", logframeCode: "OUT-1", type: "NUMBER", unit: null,
    baseline: "0", target: "1200", targetSchedule: null, frequency: null, direction: null,
    disaggregation: null, meansOfVerification: null,
  })],
  periods: [proposed({ type: "QUARTERLY", start: "2026-01-31", end: "2026-03-31" })],
  plan: [proposed({ title: "Drill", logframeCode: "ACT-1", start: "2026-02-01", end: "2026-02-02", location: null, lead: null })],
  places: [proposed({ name: "Gulu", adminLevel: 3, parentName: null, latitude: 2.7, longitude: 32.3 })],
  funding: [proposed({ sourceName: "EU", amount: "1,234.56", currency: "EUR" })],
  budget: [proposed({ category: "kits", amount: "500", currency: "EUR", logframeCode: null })],
  risks: [proposed({ kind: null, title: "Flood", seriousness: null, mitigation: "Elevate" })],
});

test("the setup proposal contract accepts a well-formed proposal", () => {
  const parsed = ProjectSetupProposalSchema.parse(validProposal());
  assert.equal(parsed.logframe[0].value.codeSource, "GENERATED");
  assert.equal(parsed.facts.name.value, "WASH Gulu");
  assert.equal(parsed.funding[0].value.amount, "1,234.56");
});

test("a quote longer than 1000 characters, a bad date or a missing status are refused", () => {
  const p = validProposal();
  p.facts.name.sourceQuote = "x".repeat(1001);
  assert.equal(ProjectSetupProposalSchema.safeParse(p).success, false);
  const q = validProposal();
  q.facts.startDate.value = "March 2026";
  assert.equal(ProjectSetupProposalSchema.safeParse(q).success, false);
  const r = validProposal();
  delete r.logframe[0].status;
  assert.equal(ProjectSetupProposalSchema.safeParse(r).success, false);
  const s = validProposal();
  s.indicators[0].value.type = "KILOGRAMS";
  assert.equal(ProjectSetupProposalSchema.safeParse(s).success, false);
});

test("review edits name an area, an item path and an operation", () => {
  assert.equal(EditSetupProposalSchema.safeParse({ area: "LOGFRAME", path: "logframe.0", op: "ACCEPT" }).success, true);
  assert.equal(EditSetupProposalSchema.safeParse({ area: "FACTS", path: "facts.name", op: "EDIT", value: "Renamed" }).success, true);
  assert.equal(EditSetupProposalSchema.safeParse({ area: "LOGFRAME", path: "logframe.0.code", op: "ACCEPT" }).success, false);
  assert.equal(EditSetupProposalSchema.safeParse({ area: "LOGFRAME", path: "logframe", op: "ACCEPT" }).success, false);
  assert.equal(EditSetupProposalSchema.safeParse({ area: "NOT_AN_AREA", path: "logframe.0", op: "ACCEPT" }).success, false);
  assert.equal(EditSetupProposalSchema.safeParse({ area: "LOGFRAME", path: "budget.0", op: "REJECT" }).success, true);
});

test("apply, settings and problem contracts keep their small shapes", () => {
  assert.equal(SetupAreaSelectionSchema.safeParse({}).success, true);
  assert.equal(SetupAreaSelectionSchema.safeParse({ areas: [] }).success, true);
  assert.equal(SetupAreaSelectionSchema.safeParse({ areas: ["NOT_AN_AREA"] }).success, false);
  assert.equal(ApplySetupProposalSchema.safeParse({ areas: [] }).success, false, "apply needs the project form");
  assert.deepEqual(SetupAssistSettingsSchema.parse({ enabled: true }), { enabled: true });
  const problem = SetupProblemSchema.safeParse({ code: "END_BEFORE_START", path: "facts.endDate", severity: "HARD", message: "The project ends before it starts.", params: { start: "2026", end: "2025" } });
  assert.equal(problem.success, true);
  assert.equal(SetupProblemSchema.safeParse({ code: "NOT_A_CODE", path: "x", severity: "HARD", message: "m" }).success, false);
  assert.deepEqual([...SETUP_AREA_KEYS].sort(), ["FACTS", "FUNDING_BUDGET", "INDICATORS", "LOGFRAME", "PERIODS", "PLAN", "PLACES", "RISKS"].sort());
  assert.equal(SETUP_PROBLEM_CODES.length, 18);
});
