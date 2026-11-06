import test from "node:test";
import assert from "node:assert/strict";
import {
  SETUP_AREAS, SETUP_AREA_KEYS, SETUP_AREA_APPLY_ORDER,
  groundProposed, groundAreaPatch, datesInText, lowerConfidence, joinBlocks,
  checkProposal, blockingProblems, planApply,
  acceptItem, rejectItem, editValue, fillNotStated,
} from "../dist/index.js";

// ---------- fixtures ----------

const P = (value, quote = "…", extra = {}) => ({
  value,
  sourceQuote: quote,
  sourceRef: { documentId: "d1", block: 0 },
  confidence: "HIGH",
  status: "PROPOSED",
  ...extra,
});

const node = (patch = {}) => ({ level: "GOAL", code: null, title: "t", description: null, parentCode: null, ...patch });

const clean = () => ({
  facts: {
    name: P("WASH Gulu", "Project title: WASH Gulu", { status: "ACCEPTED" }),
    code: P("WG-1", "code WG-1"),
    donor: P("EU", "European Union"),
    countries: P(["Uganda"], "in Uganda"),
    sectors: P(["WASH"], "water, sanitation"),
    startDate: P("2026-01-01", "starts on 1 January 2026"),
    endDate: P("2027-12-31", "ends 31 December 2027"),
    currency: P("EUR", "in EUR"),
    summary: P("Water for households.", "Water for households."),
  },
  logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [],
});

const DOCUMENT = "The project targets 1,200 households. Start date: 1 March 2026. End date: 25/03/2026. Budget: EUR 1,234.56.";

// ---------- SETUP_AREAS: the one exhaustive table ----------

test("SETUP_AREAS covers exactly the eight areas, in a consistent dependency-respecting order", () => {
  assert.deepEqual([...SETUP_AREA_KEYS].sort(), ["FACTS", "FUNDING_BUDGET", "INDICATORS", "LOGFRAME", "PERIODS", "PLAN", "PLACES", "RISKS"].sort());
  assert.deepEqual([...SETUP_AREA_KEYS].map((k) => SETUP_AREAS[k].applyOrder).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(SETUP_AREA_APPLY_ORDER[0], "FACTS");
  assert.equal(SETUP_AREA_APPLY_ORDER[SETUP_AREA_APPLY_ORDER.length - 1], "RISKS");
  for (const key of SETUP_AREA_KEYS) {
    const row = SETUP_AREAS[key];
    assert.match(row.labelKey, /^setup\.area\.[a-z]/);
    assert.ok(row.fields.length > 0);
    for (const dependency of row.dependsOn) {
      // The one reverse pair: places are read after the plan (from its locations) but applied before it (the plan links to them).
      if (key === "PLACES" && dependency === "PLAN") continue;
      assert.ok(SETUP_AREAS[dependency].applyOrder < row.applyOrder, `${dependency} must precede ${key}`);
    }
  }
});

test("each area's fields name real proposal fields, and counts read its own items", () => {
  const p = clean();
  p.logframe = [P(node({ code: "GOAL-1" }), "q", { status: "ACCEPTED" }), P(node({ code: "OUT-1" }), "q"), P(node(), "q", { status: "EDITED" })];
  p.funding = [P({ sourceName: "EU", amount: "1000", currency: "EUR" }, "q", { status: "ACCEPTED" })];
  p.budget = [P({ category: "kits", amount: "500", currency: "EUR" }, "q")];
  p.risks = [P({ kind: null, title: "flood", seriousness: null, mitigation: null }, "q", { status: "REJECTED" })];
  const empty = clean();
  for (const key of SETUP_AREA_KEYS) {
    const row = SETUP_AREAS[key];
    assert.equal(typeof row.items(p), "number", key);
    assert.equal(typeof row.accepted(p), "number", key);
    for (const field of row.fields) assert.ok(field in empty, `${key} owns ${field}`);
  }
  assert.equal(SETUP_AREAS.LOGFRAME.items(p), 3);
  assert.equal(SETUP_AREAS.LOGFRAME.accepted(p), 2);
  assert.equal(SETUP_AREAS.FUNDING_BUDGET.items(p), 2);
  assert.equal(SETUP_AREAS.FUNDING_BUDGET.accepted(p), 1);
  assert.equal(SETUP_AREAS.RISKS.accepted(p), 0);
  assert.equal(SETUP_AREAS.INDICATORS.items(clean()), 0);
});

// ---------- grounding ----------

test("grounding: verbatim quotes pass, with whitespace differences and one figure spelling", () => {
  assert.deepEqual(groundProposed(P("1200", "targets 1,200 households"), DOCUMENT), { grounded: true, confidence: "HIGH" });
  assert.ok(groundProposed(P("1200.0", "targets 1,200 households"), DOCUMENT).grounded);
  assert.ok(groundProposed(P("1234.56", "Budget: EUR 1,234.56."), DOCUMENT).grounded);
  assert.ok(groundProposed(P("1200", "targets\n1,200   households."), DOCUMENT).grounded);
  assert.ok(groundProposed(P(1200, "targets 1,200 households"), DOCUMENT).grounded);
});

test("grounding: a quote may state the date in words; an unambiguous numeric date grounds its ISO day", () => {
  assert.ok(groundProposed(P("2026-03-01", "Start date: 1 March 2026."), DOCUMENT).grounded);
  assert.ok(groundProposed(P("2026-03-01", "start on the 1st March 2026"), "start on the 1st March 2026").grounded);
  assert.ok(groundProposed(P("2026-03-25", "End date: 25/03/2026."), DOCUMENT).grounded);
  assert.ok(groundProposed(P("2026-03-25", "due March 25, 2026"), "due March 25, 2026").grounded);
});

test("grounding: a near-miss quote, a figure and a date the quote does not state are dropped", () => {
  assert.deepEqual(groundProposed(P("1200", "targets 2,400 households"), DOCUMENT), { grounded: false, reason: "QUOTE_NOT_FOUND" });
  assert.deepEqual(groundProposed(P("1200", "the target is 1200"), DOCUMENT), { grounded: false, reason: "QUOTE_NOT_FOUND" });
  assert.deepEqual(groundProposed(P("4800", "targets 1,200 households"), DOCUMENT), { grounded: false, reason: "FIGURE_NOT_IN_QUOTE" });
  assert.deepEqual(groundProposed(P("200", "targets 1,200 households"), DOCUMENT), { grounded: false, reason: "FIGURE_NOT_IN_QUOTE" });
  assert.deepEqual(groundProposed(P("2026-04-01", "Start date: 1 March 2026."), DOCUMENT), { grounded: false, reason: "DATE_NOT_IN_QUOTE" });
  assert.deepEqual(groundProposed(P("2026-03-04", "by 3/4/2026"), "a review by 3/4/2026"), { grounded: false, reason: "DATE_NOT_IN_QUOTE" });
});

test("an edited value is the person's own and skips the check; the lower confidence reading wins", () => {
  assert.deepEqual(groundProposed(P("9999", "nothing", { status: "EDITED" }), DOCUMENT), { grounded: true, confidence: "HIGH" });
  assert.equal(lowerConfidence("HIGH", "LOW"), "LOW");
  assert.equal(lowerConfidence("MEDIUM", "HIGH"), "MEDIUM");
  assert.equal(lowerConfidence("HIGH", "HIGH"), "HIGH");
});

test("datesInText reads ISO and month names, never an ambiguous numeric date; source text is joined in one normalised spelling", () => {
  assert.deepEqual(
    [...new Set(datesInText("from 1 March 2026 to 2026-12-31; by Sep 30, 2026; review 25/12/2026"))].sort(),
    ["2026-03-01", "2026-09-30", "2026-12-25", "2026-12-31"],
  );
  assert.deepEqual(datesInText("sometime in 3/4/2026"), []);
  assert.deepEqual(datesInText("not a date 2026-13-40"), []);
  assert.equal(joinBlocks([{ documentId: "d", index: 0, text: "a\nb" }, { documentId: "d", index: 1, text: "c" }]), "a b c");
});

// ---------- checkProposal: one row per problem code ----------

test("a clean proposal has no problems and no blockers", () => {
  const p = clean();
  p.logframe = [P(node({ code: "GOAL-1" }), "q"), P(node({ level: "OUTCOME", code: "OUT-1", parentCode: "GOAL-1" }), "q")];
  p.indicators = [P({ code: "IND-1", title: "i", logframeCode: "OUT-1", type: "NUMBER", unit: null, baseline: "0", target: "100", targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, "q")];
  p.periods = [P({ type: "QUARTERLY", start: "2026-03-31", end: "2026-06-30" }, "q")];
  p.funding = [P({ sourceName: "EU", amount: "1000", currency: "EUR" }, "q")];
  assert.deepEqual(checkProposal(p), []);
});

test("FACTS_NAME_REQUIRED when the project has no name", () => {
  const p = clean();
  p.facts.name = P(null, "", { status: "PROPOSED" });
  assert.deepEqual(checkProposal(p).map((x) => x.code), ["FACTS_NAME_REQUIRED"]);
  assert.equal(blockingProblems(checkProposal(p)).length, 1);
});

test("END_BEFORE_START for the project, a period and an activity; each is hard", () => {
  const facts = clean();
  facts.facts.startDate = P("2027-01-01", "q");
  facts.facts.endDate = P("2026-01-01", "q");
  assert.deepEqual(checkProposal(facts).map((x) => x.code), ["END_BEFORE_START"]);
  const period = clean();
  period.periods = [P({ type: "MONTHLY", start: "2026-06-30", end: "2026-06-01" }, "q")];
  const periodProblems = checkProposal(period);
  assert.equal(periodProblems[0].code, "END_BEFORE_START");
  assert.equal(periodProblems[0].path, "periods.0");
  assert.equal(periodProblems[0].severity, "HARD");
  const activity = clean();
  activity.plan = [P({ title: "a", logframeCode: null, start: "2026-06-30", end: "2026-06-01", location: null, lead: null }, "q")];
  assert.ok(checkProposal(activity).some((x) => x.code === "END_BEFORE_START" && x.path === "plan.0" && x.severity === "HARD"));
});

test("LOGFRAME_DUPLICATE_CODE and INDICATOR_DUPLICATE_CODE name the code", () => {
  const p = clean();
  p.logframe = [P(node({ code: "GOAL-1" }), "q"), P(node({ code: "GOAL-1" }), "q")];
  const problem = checkProposal(p)[0];
  assert.equal(problem.code, "LOGFRAME_DUPLICATE_CODE");
  assert.equal(problem.severity, "HARD");
  assert.equal(problem.params.code, "GOAL-1");
  const q = clean();
  const indicator = { code: "IND-1", title: "i", logframeCode: null, type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null };
  q.indicators = [P(indicator, "q"), P({ ...indicator }, "q")];
  assert.equal(checkProposal(q)[0].code, "INDICATOR_DUPLICATE_CODE");
});

test("LOGFRAME_PARENT_UNKNOWN and LOGFRAME_CYCLE are hard problems at the offending node", () => {
  const orphan = clean();
  orphan.logframe = [P(node({ code: "OUT-1", parentCode: "GOAL-9" }), "q")];
  const orphanProblems = checkProposal(orphan);
  assert.deepEqual(orphanProblems.map((x) => x.code), ["LOGFRAME_PARENT_UNKNOWN"]);
  assert.equal(orphanProblems[0].path, "logframe.0.parentCode");
  assert.equal(orphanProblems[0].params.code, "GOAL-9");
  const cycle = clean();
  cycle.logframe = [
    P(node({ code: "GOAL-1", parentCode: "GOAL-2" }), "q"),
    P(node({ code: "GOAL-2", parentCode: "GOAL-1" }), "q"),
  ];
  const cycleProblems = checkProposal(cycle);
  assert.deepEqual(cycleProblems.filter((x) => x.severity === "HARD").map((x) => x.code), ["LOGFRAME_CYCLE"]);
  const self = clean();
  self.logframe = [P(node({ code: "GOAL-1", parentCode: "GOAL-1" }), "q")];
  assert.deepEqual(checkProposal(self).map((x) => x.code), ["LOGFRAME_CYCLE"]);
});

test("INDICATOR_LOGFRAME_UNKNOWN when the indicator names no proposed logframe code", () => {
  const p = clean();
  p.indicators = [P({ code: "IND-1", title: "i", logframeCode: "OUT-7", type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, "q")];
  const problems = checkProposal(p);
  assert.deepEqual(problems.map((x) => x.code), ["INDICATOR_LOGFRAME_UNKNOWN"]);
  assert.equal(problems[0].path, "indicators.0.logframeCode");
  assert.equal(problems[0].params.code, "OUT-7");
});

test("PERIOD_OUTSIDE_DATES and ACTIVITY_OUTSIDE_DATES are soft advice", () => {
  const p = clean();
  p.periods = [P({ type: "MONTHLY", start: "2025-12-01", end: "2026-01-31" }, "q")];
  p.plan = [P({ title: "a", logframeCode: null, start: "2028-01-05", end: "2028-01-06", location: null, lead: null }, "q")];
  const problems = checkProposal(p);
  assert.deepEqual(problems.map((x) => x.code), ["PERIOD_OUTSIDE_DATES", "ACTIVITY_OUTSIDE_DATES"]);
  assert.deepEqual(problems.map((x) => x.severity), ["SOFT", "SOFT"]);
  assert.equal(problems[0].path, "periods.0");
  assert.equal(problems[1].path, "plan.0");
});

test("CURRENCY_NOT_STATED for funding and budget rows that name no currency", () => {
  const p = clean();
  p.funding = [P({ sourceName: "EU", amount: "1000", currency: null }, "q")];
  p.budget = [P({ category: "kits", amount: "500", currency: null }, "q")];
  const problems = checkProposal(p);
  assert.deepEqual(problems.map((x) => x.code), ["CURRENCY_NOT_STATED", "CURRENCY_NOT_STATED"]);
  assert.deepEqual(problems.map((x) => x.path), ["funding.0", "budget.0"]);
  assert.deepEqual(blockingProblems(problems), []);
});

test("a rejected item is not checked; problems never carry a bare code without a sentence and path", () => {
  const p = clean();
  p.funding = [P({ sourceName: "EU", amount: "1000", currency: null }, "q", { status: "REJECTED" })];
  p.facts.name = P(null, "", { status: "REJECTED" });
  assert.deepEqual(checkProposal(p), []);
  for (const problem of checkProposal(p)) {
    assert.ok(problem.message.length > 5);
    assert.ok(problem.path.length > 0);
  }
});

// ---------- planApply ----------

const allSelected = Object.fromEntries(SETUP_AREA_KEYS.map((k) => [k, true]));

test("planApply lists the selected areas with accepted items in apply order", () => {
  const p = clean();
  p.logframe = [P(node(), "q", { status: "ACCEPTED" })];
  p.indicators = [P({ code: "IND-1", title: "i", logframeCode: null, type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, "q", { status: "EDITED" })];
  p.periods = [P({ type: "MONTHLY", start: "2026-01-31", end: "2026-01-31" }, "q", { status: "ACCEPTED" })];
  p.places = [P({ name: "Gulu", adminLevel: null, parentName: null, latitude: null, longitude: null }, "q", { status: "ACCEPTED" })];
  p.funding = [P({ sourceName: "EU", amount: "1000", currency: "EUR" }, "q", { status: "ACCEPTED" })];
  p.risks = [P({ kind: null, title: "flood", seriousness: null, mitigation: null }, "q", { status: "ACCEPTED" })];
  const plan = planApply(p, allSelected);
  assert.deepEqual(plan.steps.map((s) => s.area), ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "FUNDING_BUDGET", "RISKS"]);
  assert.deepEqual(plan.steps.map((s) => s.order), [1, 2, 3, 4, 7, 8]);
  assert.equal(plan.steps.find((s) => s.area === "INDICATORS").items, 1);
  assert.equal(plan.steps.find((s) => s.area === "FACTS").items, 1);
  assert.deepEqual(plan.skipped, [
    { area: "PLACES", reason: "DEPENDENCY_SKIPPED", missingDependency: "PLAN" },
    { area: "PLAN", reason: "NOTHING_ACCEPTED" },
  ]);
});

test("planApply skips unselected areas and propagates a skipped dependency with its reason", () => {
  const p = clean();
  p.indicators = [P({ code: "IND-1", title: "i", logframeCode: null, type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, "q", { status: "ACCEPTED" })];
  p.plan = [P({ title: "a", logframeCode: null, start: "2026-02-01", end: "2026-02-02", location: null, lead: null }, "q", { status: "ACCEPTED" })];
  p.places = [P({ name: "Gulu", adminLevel: null, parentName: null, latitude: null, longitude: null }, "q", { status: "ACCEPTED" })];
  p.risks = [P({ kind: null, title: "flood", seriousness: null, mitigation: null }, "q", { status: "ACCEPTED" })];
  const plan = planApply(p, { FACTS: true, INDICATORS: true, PLAN: true, PLACES: true, RISKS: true });
  assert.deepEqual(plan.steps.map((s) => s.area), ["FACTS", "RISKS"]);
  const skipped = Object.fromEntries(plan.skipped.map((s) => [s.area, s.reason]));
  assert.equal(skipped.LOGFRAME, "NOT_SELECTED");
  assert.equal(skipped.INDICATORS, "DEPENDENCY_SKIPPED");
  assert.equal(skipped.PERIODS, "NOT_SELECTED");
  assert.equal(skipped.PLAN, "DEPENDENCY_SKIPPED");
  assert.equal(plan.skipped.find((s) => s.area === "PLAN").missingDependency, "LOGFRAME");
  assert.equal(skipped.PLACES, "DEPENDENCY_SKIPPED");
  assert.equal(plan.skipped.find((s) => s.area === "PLACES").missingDependency, "PLAN");
  assert.equal(skipped.FUNDING_BUDGET, "NOT_SELECTED");
});

test("planApply is deterministic and refuses nothing: the same inputs give the same plan", () => {
  const nothingAccepted = clean();
  nothingAccepted.facts.name = P("WASH Gulu", "q", { status: "PROPOSED" });
  assert.deepEqual(planApply(nothingAccepted, allSelected).steps, []);
  assert.deepEqual(planApply(nothingAccepted, allSelected), planApply(nothingAccepted, allSelected));
  const some = clean();
  assert.deepEqual(planApply(some, allSelected), planApply(some, allSelected));
});

test("groundAreaPatch drops every ungrounded item of an area patch, counts them, and refuses foreign fields", () => {
  const factsPatch = {
    name: P("Blue Water", "The project is named Blue Water."),
    code: P(null, null),
    donor: P("Nowhere Foundation", "a quote that is not in the text"),
    countries: P(null, null), sectors: P(null, null), startDate: P(null, null),
    endDate: P(null, null), currency: P(null, null), summary: P(null, null),
  };
  const grounded = groundAreaPatch("FACTS", { facts: factsPatch }, "The project is named Blue Water.");
  assert.ok(!("error" in grounded));
  assert.deepEqual(grounded.fields.facts.name, factsPatch.name, "the grounded item survives");
  assert.equal(grounded.fields.facts.donor.value, null, "a dropped fact becomes Not stated, the record keeps its shape");
  assert.equal(grounded.fields.facts.donor.sourceQuote, null);
  assert.equal(grounded.checked, 2);
  assert.equal(grounded.dropped, 1);
  const foreign = groundAreaPatch("LOGFRAME", { funding: [] }, "text");
  assert.ok("error" in foreign);
  assert.match(foreign.error, /does not own/);
  const arrays = groundAreaPatch("LOGFRAME", { logframe: [P(node({ code: "GOAL-1" }), "GOAL-1: Clean water for all."), P(node({ code: "OUT-9" }), "not in the text")] }, "GOAL-1: Clean water for all.");
  assert.ok(!("error" in arrays));
  assert.equal(arrays.fields.logframe.length, 1);
  assert.equal(arrays.dropped, 1);
  const nulls = groundAreaPatch("FUNDING_BUDGET", { funding: [P(null, null)], budget: [P({ category: "Budget", amount: null, currency: "EUR", logframeCode: null }, "Budget is EUR 1,000.")] }, "Budget is EUR 1,000.");
  assert.ok(!("error" in nulls));
  assert.equal(nulls.fields.funding.length, 1, "a not-stated item needs no quote and is kept");
  assert.equal(nulls.fields.budget.length, 1);
  assert.equal(nulls.checked, 1, "only the stated budget row is checked");
});

// ---------- review edits ----------

test("accept and reject decide one item and never mutate the proposal they were given", () => {
  const p = clean();
  p.logframe = [P(node({ code: "GOAL-1" }), "q")];
  const original = JSON.stringify(p);
  const ref = { area: "LOGFRAME", path: "logframe.0" };
  const accepted = acceptItem(p, ref);
  assert.ok(accepted.ok);
  assert.equal(accepted.proposal.logframe[0].status, "ACCEPTED");
  assert.equal(p.logframe[0].status, "PROPOSED");
  assert.equal(JSON.stringify(p), original);
  const rejected = rejectItem(p, ref);
  assert.ok(rejected.ok);
  assert.equal(rejected.proposal.logframe[0].status, "REJECTED");
  assert.equal(SETUP_AREAS.LOGFRAME.accepted(rejected.proposal), 0);
  assert.equal(SETUP_AREAS.LOGFRAME.accepted(accepted.proposal), 1);
});

test("editValue replaces the value, marks EDITED, keeps the quote, and is then exempt from grounding", () => {
  const p = clean();
  p.logframe = [P(node({ code: "GOAL-1" }), "q")];
  const edited = editValue(p, { area: "LOGFRAME", path: "logframe.0" }, node({ code: "G1", title: "rewritten" }));
  assert.ok(edited.ok);
  const item = edited.proposal.logframe[0];
  assert.equal(item.status, "EDITED");
  assert.equal(item.value.code, "G1");
  assert.equal(item.sourceQuote, "q");
  assert.deepEqual(groundProposed(item, "the quote is not in this text"), { grounded: true, confidence: "HIGH" });
  assert.equal(SETUP_AREAS.LOGFRAME.accepted(edited.proposal), 1);
  const cleared = editValue(p, { area: "LOGFRAME", path: "logframe.0" }, null);
  assert.ok(cleared.ok);
  assert.equal(cleared.proposal.logframe[0].value, null);
  const missing = editValue(p, { area: "LOGFRAME", path: "logframe.0" }, undefined);
  assert.equal(missing.ok, false);
});

test("fillNotStated fills a value the document did not state, and refuses one that has a value", () => {
  const p = clean();
  p.logframe = [P(null, null)];
  const filled = fillNotStated(p, { area: "LOGFRAME", path: "logframe.0" }, node({ title: "typed by hand" }));
  assert.ok(filled.ok);
  assert.equal(filled.proposal.logframe[0].status, "EDITED");
  assert.equal(filled.proposal.logframe[0].value.title, "typed by hand");
  const again = fillNotStated(filled.proposal, { area: "LOGFRAME", path: "logframe.0" }, node({ title: "x" }));
  assert.equal(again.ok, false);
  const nothing = fillNotStated(p, { area: "LOGFRAME", path: "logframe.0" }, null);
  assert.equal(nothing.ok, false);
  const p2 = clean();
  p2.facts.code = P(null, null);
  const fact = fillNotStated(p2, { area: "FACTS", path: "facts.code" }, "NEWCODE");
  assert.ok(fact.ok);
  assert.equal(fact.proposal.facts.code.value, "NEWCODE");
  assert.equal(fact.proposal.facts.code.status, "EDITED");
  assert.equal(SETUP_AREAS.FACTS.accepted(fact.proposal), 2);
});

test("refusals: unknown area, a path outside the area's fields, and paths that are not exactly an item", () => {
  const p = clean();
  p.logframe = [P(node(), "q")];
  const unknownArea = acceptItem(p, { area: "NOT_AN_AREA", path: "logframe.0" });
  assert.equal(unknownArea.ok, false);
  const wrongArea = acceptItem(p, { area: "LOGFRAME", path: "budget.0" });
  assert.equal(wrongArea.ok, false);
  const shortPath = acceptItem(p, { area: "LOGFRAME", path: "logframe" });
  assert.equal(shortPath.ok, false);
  const deepPath = acceptItem(p, { area: "LOGFRAME", path: "logframe.0.code" });
  assert.equal(deepPath.ok, false);
  const outOfRange = acceptItem(p, { area: "LOGFRAME", path: "logframe.7" });
  assert.equal(outOfRange.ok, false);
  const unknownField = acceptItem(p, { area: "FACTS", path: "facts.nickname" });
  assert.equal(unknownField.ok, false);
});

test("link and classification fields are not figures of the item's own quote", () => {
  const q = "Outcome 1.1: Households use safe water.";
  const item = (value) => ({ value, sourceQuote: q, sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
  assert.equal(groundProposed(item({ code: "1.1", parentCode: "1", title: "Households use safe water" }), q).grounded, true);
  assert.equal(groundProposed(item({ code: "1.1", title: "Households use 75 safe water" }), q).grounded, false, "a real figure still needs its quote");
});

test("extraction layers: an area waits only for the areas it depends on, everything else runs together", async () => {
  const { extractionLayers, SETUP_AREA_KEYS, SETUP_AREAS } = await import("../dist/index.js");
  const layers = extractionLayers(SETUP_AREA_KEYS);
  assert.deepEqual(layers, [["FACTS", "RISKS"], ["LOGFRAME", "PERIODS", "FUNDING_BUDGET"], ["INDICATORS", "PLAN"], ["PLACES"]]);
  // Every area comes after everything it depends on.
  const at = new Map(layers.flatMap((l, i) => l.map((a) => [a, i])));
  for (const area of SETUP_AREA_KEYS) for (const dep of SETUP_AREAS[area].dependsOn) assert.ok(at.get(dep) < at.get(area), `${area} after ${dep}`);
  // A dependency nobody extracts holds nothing up; unregistered areas are absent.
  assert.deepEqual(extractionLayers(["PLAN", "PLACES"]), [["PLAN"], ["PLACES"]]);
  assert.deepEqual(extractionLayers(["LOGFRAME"]), [["LOGFRAME"]]);
  assert.deepEqual(extractionLayers([]), []);
});

test("a hyphenated day-month-year date (01-Sep-2025) is read as the day it states", async () => {
  const { datesInText } = await import("../dist/index.js");
  assert.deepEqual(datesInText("Implementation period 01-Sep-2025 - 28-Feb-2026").sort(), ["2025-09-01", "2026-02-28"]);
});

test("rejecting a result clears the parent link of what sat under it", async () => {
  const { rejectItem } = await import("../dist/index.js");
  const node = (code, parentCode) => ({ value: { level: "ACTIVITY", code, parentCode, title: code }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "ACCEPTED" });
  const p = { logframe: [node("SO2", null), node("A1", "SO2")], indicators: [], plan: [], places: [], periods: [], funding: [], budget: [], risks: [], facts: {} };
  const r = rejectItem(p, { area: "LOGFRAME", path: "logframe.0" });
  assert.equal(r.ok, true);
  assert.equal(r.proposal.logframe[1].value.parentCode, null);
});

test("template placeholders: a slot nobody filled is left out, a placeholder inside real text is removed (one row per pattern)", async () => {
  const { templatePlaceholder, withoutPlaceholders, groundAreaPatch } = await import("../dist/index.js");
  for (const t of ["To be completed after identification of priority interventions.", "Activity 1.1.1", "Activity 1.1.1 - To be completed after identification of priority i...", "Standard Activity: Not Selected", "Outcome Indicator 1.1(Custom)", "[insert project title]"]) assert.equal(templatePlaceholder(t), "WHOLE", t);
  assert.equal(templatePlaceholder("Emergency water trucking"), null);
  assert.equal(templatePlaceholder("crisis-affected populations in [insert target districts/regions]. The target areas"), "PART");
  assert.equal(withoutPlaceholders("crisis-affected populations in [insert target districts/regions]. The target areas"), "crisis-affected populations in. The target areas");
  const text = "Activity 1.1.1 - To be completed after identification of priority interventions. Emergency water trucking.";
  const item = (title, quote) => ({ value: { title, start: null, end: null, location: null, logframeCode: null }, sourceQuote: quote, sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
  const g = groundAreaPatch("PLAN", { plan: [item("Activity 1.1.1 - To be completed after identification of priority i...", "Activity 1.1.1 - To be completed"), item("Emergency water trucking", "Emergency water trucking")] }, text);
  assert.equal(g.fields.plan.length, 1);
  assert.equal(g.leftOut[0].reason, "TEMPLATE_PLACEHOLDER");
});

test("amounts with a currency mark are read, and the mark names the currency", async () => {
  const { normaliseAmountText, splitAmountCurrency } = await import("../dist/index.js");
  assert.equal(normaliseAmountText("$500,000.30"), "500000.30");
  assert.equal(splitAmountCurrency("$500,000.30").currency, "USD");
  assert.equal(splitAmountCurrency("€2.500,50").currency, "EUR");
  assert.equal(normaliseAmountText("12500 KES"), "12500");
  assert.equal(normaliseAmountText("US$ 1,250"), null, "still ambiguous without decimals");
});

test("a budget line with no currency is offered the project's stated currency (MEDIUM), never one it names itself", async () => {
  const { offerProjectCurrency } = await import("../dist/index.js");
  const P = (value, status = "PROPOSED") => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status });
  const p = { facts: { currency: P("USD") }, funding: [], budget: [P({ category: "G.1", amount: "467,290.00", currency: null, logframeCode: null }), P({ category: "PSC", amount: "10", currency: "EUR", logframeCode: null })] };
  const out = offerProjectCurrency(p);
  assert.equal(out.budget[0].value.currency, "USD");
  assert.equal(out.budget[0].confidence, "MEDIUM");
  assert.equal(out.budget[1].value.currency, "EUR");
});

test("with no stated project currency, budget lines are offered the one currency the funding names", async () => {
  const { offerProjectCurrency } = await import("../dist/index.js");
  const P = (value) => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
  const line = P({ category: "G.1", amount: "1", currency: null, logframeCode: null });
  const p = { facts: { currency: { value: null, status: "PROPOSED" } }, funding: [P({ sourceName: "CBPF", amount: "$1", currency: "USD" })], budget: [line] };
  assert.equal(offerProjectCurrency(p).budget[0].value.currency, "USD");
  assert.equal(offerProjectCurrency({ ...p, funding: [] }).budget[0].value.currency, null);
});

test("places are applied before the plan, so the work-plan import can link each row's location to a place", () => {
  assert.ok(SETUP_AREAS.PLACES.applyOrder < SETUP_AREAS.PLAN.applyOrder);
  assert.ok(SETUP_AREA_APPLY_ORDER.indexOf("PLACES") < SETUP_AREA_APPLY_ORDER.indexOf("PLAN"));
});
