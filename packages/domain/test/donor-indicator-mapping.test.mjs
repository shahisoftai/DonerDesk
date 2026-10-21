import test from "node:test";
import assert from "node:assert/strict";
import { mapDonorIndicators, namesCode, nameOverlap, summariseDonorIndicatorMapping, openDonorIndicatorQuestions } from "../dist/index.js";

const indicators = [
  { id: "i1", code: "IND-W-001", name: "Number of people with access to safe water" },
  { id: "i2", code: "IND-W-002", name: "Number of household latrines constructed" },
  { id: "i3", code: "IND-H-001", name: "Percentage of children vaccinated" },
];
const req = (id, text) => ({ id, text });

test("a requirement that names an indicator's code is mapped to it", () => {
  const [r] = mapDonorIndicators([req("r1", "Report IND-W-002 monthly, disaggregated by sex")], indicators);
  assert.equal(r.status, "MAPPED");
  assert.equal(r.indicatorId, "i2");
  assert.match(r.basis, /IND-W-002/);
});

test("a code inside a longer code is not a match", () => {
  assert.equal(namesCode("see IND-W-0011", "IND-W-001"), false);
  assert.equal(namesCode("see (IND-W-001)", "IND-W-001"), true);
  assert.equal(namesCode("see ind-w-001.", "IND-W-001"), true);
});

test("close wording is only a suggestion; a person confirms it", () => {
  const [r] = mapDonorIndicators([req("r1", "Number of people accessing safe water points")], indicators);
  assert.equal(r.status, "SUGGESTED");
  assert.equal(r.indicatorId, "i1");
});

test("nothing close is unmapped, and the answer says so", () => {
  const [r] = mapDonorIndicators([req("r1", "Number of teachers trained in child protection")], indicators);
  assert.equal(r.status, "UNMAPPED");
  assert.equal(r.indicatorId, null);
});

test("two equally close indicators are not guessed between", () => {
  const twins = [{ id: "a", code: "A", name: "Households with latrines" }, { id: "b", code: "B", name: "Households with latrines" }];
  const [r] = mapDonorIndicators([req("r1", "Households with latrines")], twins);
  assert.equal(r.status, "UNMAPPED");
  assert.deepEqual(r.alternatives, ["a", "b"]);
});

test("a person's decision wins; 'not tracked' is an answer, not a gap", () => {
  const rows = mapDonorIndicators(
    [req("r1", "Teachers trained"), req("r2", "Number of people with safe water"), req("r3", "Vaccinated children")],
    indicators,
    { r1: { indicatorId: "i3" }, r2: { indicatorId: null } },
  );
  assert.deepEqual(rows.map((r) => r.status), ["MAPPED", "NOT_TRACKED", "SUGGESTED"]);
  assert.equal(rows[0].indicatorId, "i3");
  assert.deepEqual(summariseDonorIndicatorMapping(rows), { total: 3, mapped: 1, suggested: 1, unmapped: 0, notTracked: 1 });
  assert.equal(openDonorIndicatorQuestions(rows), 1);
});

test("a decision that names a removed indicator no longer counts", () => {
  const [r] = mapDonorIndicators([req("r1", "Teachers trained")], indicators, { r1: { indicatorId: "gone" } });
  assert.equal(r.status, "UNMAPPED");
});

test("overlap ignores filler words and plurals", () => {
  assert.equal(nameOverlap("The number of latrines constructed", "Number of household latrines constructed") > 0.6, true);
  assert.equal(nameOverlap("", "Wells"), 0);
});
