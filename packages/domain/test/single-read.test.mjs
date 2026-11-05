// Single-read reply -> per-area fields -> the existing grounding. Pure: built output (dist) only.
import test from "node:test";
import assert from "node:assert/strict";
import { singleReadFields, groundAreaPatch, SETUP_AREA_KEYS } from "../dist/index.js";

const SOURCE = [
  "Project title: Clean Water for Baidoa. Project code: CBPF-SOM-25-S-NGO-37159.",
  "Implementation period 01-Sep-2025 - 28-Feb-2026. Project budget $500,000.30.",
  "Outcome 1: Improved access to water in Baidoa.",
].join("\n");

const reply = {
  facts: {
    name: { value: "Clean Water for Baidoa", quote: "Project title: Clean Water for Baidoa" },
    code: { value: "CBPF-SOM-25-S-NGO-37159", quote: "Project code: CBPF-SOM-25-S-NGO-37159" },
    countries: { value: ["Somalia"], quote: null },
    startDate: { value: "2025-09-01", quote: "01-Sep-2025" },
    endDate: { value: null, quote: null },
    donor: { value: null, quote: null },
  },
  logframe: [
    { level: "OUTCOME", code: "1", title: "Improved access to water in Baidoa.", parentCode: null, quote: "Outcome 1: Improved access to water in Baidoa." },
    { level: "BOGUS", code: "2", title: "Ignored: unknown level", quote: "x" },
  ],
  funding: [{ sourceName: "CBPF", amount: 500000.3, currency: "USD", quote: "Project budget $500,000.30." }],
  places: [{ name: "Baidoa", adminLevel: 2, parentName: "Bay", quote: "Baidoa" }, { name: "Nowhere", adminLevel: 9, quote: "" }],
  risks: [{ kind: "ASSUMPTION", title: "Safe access", seriousness: "HIGH", quote: "safe access" }],
};

test("every area is always present, so a missing part is 'not stated' rather than missing", () => {
  const fields = singleReadFields(null);
  assert.deepEqual(Object.keys(fields).sort(), [...SETUP_AREA_KEYS].sort());
  assert.deepEqual(fields.LOGFRAME, { logframe: [] });
  assert.equal(fields.FACTS.facts.name.value, null);
});

test("a stated value keeps its quote; a null value is Not stated with no quote", () => {
  const { facts } = singleReadFields(reply).FACTS;
  assert.equal(facts.name.value, "Clean Water for Baidoa");
  assert.equal(facts.name.sourceQuote, "Project title: Clean Water for Baidoa");
  assert.equal(facts.endDate.value, null);
  assert.equal(facts.endDate.sourceQuote, null);
  assert.deepEqual(facts.countries.value, ["Somalia"]);
});

test("items with an unknown level or a missing title are skipped, never guessed", () => {
  const { logframe } = singleReadFields(reply).LOGFRAME;
  assert.equal(logframe.length, 1);
  assert.equal(logframe[0].value.level, "OUTCOME");
});

test("numbers become strings, an out-of-range admin level becomes null", () => {
  const { funding } = singleReadFields(reply).FUNDING_BUDGET;
  assert.equal(funding[0].value.amount, "500000.3");
  const { places } = singleReadFields(reply).PLACES;
  assert.equal(places[1].value.adminLevel, null);
});

test("the reply's fields pass the existing grounding: a quote not in the document is dropped", () => {
  const fields = singleReadFields(reply);
  const grounded = groundAreaPatch("LOGFRAME", fields.LOGFRAME, SOURCE, []);
  assert.ok(!("error" in grounded));
  assert.equal(grounded.fields.logframe.length, 1);
  const bad = singleReadFields({ logframe: [{ level: "GOAL", title: "Invented goal", quote: "a sentence that is not in the document at all" }] });
  const dropped = groundAreaPatch("LOGFRAME", bad.LOGFRAME, SOURCE, []);
  assert.ok(!("error" in dropped));
  assert.equal(dropped.fields.logframe.length, 0);
  assert.ok(dropped.leftOut.length >= 1);
});

test("a grand total or subtotal row is a TOTAL whatever the model called it; a category named 'Total ...' stays a line", () => {
  const { budget } = singleReadFields({
    budget: [
      { category: "Total Cost", amount: "500000.30", kind: "LINE", quote: "Total Cost 500,000.30" },
      { category: "Total Direct Costs", amount: 56611643.5, kind: "LINE", quote: "Total Direct Costs" },
      { category: "Subtotal, Local Staff", amount: "1", kind: "LINE", quote: "Subtotal" },
      { category: "TOTAL PROJECT BUDGET", amount: "2", quote: "TOTAL PROJECT BUDGET" },
      { category: "Total Personnel", amount: "19015000", kind: "LINE", quote: "Total Personnel" },
      { category: "Fringe Benefits", amount: "3", quote: "Fringe Benefits" },
      { category: "PSC", amount: "32710.30", kind: "DETAIL", quote: "PSC" },
    ],
  }).FUNDING_BUDGET;
  const kinds = Object.fromEntries(budget.map((b) => [b.value.category, b.value.kind]));
  assert.equal(kinds["Total Cost"], "TOTAL");
  assert.equal(kinds["Total Direct Costs"], "TOTAL");
  assert.equal(kinds["Subtotal, Local Staff"], "TOTAL");
  assert.equal(kinds["TOTAL PROJECT BUDGET"], "TOTAL");
  assert.equal(kinds["Total Personnel"], "LINE");
  assert.equal(kinds["Fringe Benefits"], "LINE");
  assert.equal(kinds["PSC"], "DETAIL");
});
