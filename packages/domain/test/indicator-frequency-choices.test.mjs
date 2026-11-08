import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_INDICATORS, FREQUENCY_CHOICES, frequencyKind, isDueInPeriod, expectedInPeriod, pickNodeFor, BUILT_IN_CONTENT, evaluateRequirements, SETUP_REQUIREMENTS } from "../dist/index.js";

const window = (end) => ({ projectStart: new Date("2027-01-01T00:00:00Z"), periodEnd: new Date(end) });

test("every frequency the sector library uses is one a person can pick in the wizard", () => {
  const known = new Set(FREQUENCY_CHOICES.map((c) => c.value));
  const unknown = [...new Set(BUILT_IN_INDICATORS.map((e) => e.frequency))].filter((f) => !known.has(f));
  assert.deepEqual(unknown, []);
});

test("a survey or distribution indicator is not due in an ordinary month, but is expected where a value is recorded and in the closing period", () => {
  for (const f of ["Per survey", "Per distribution", "Per campaign", "At construction", "per round"]) {
    assert.equal(frequencyKind(f), "EVENT", f);
    assert.equal(isDueInPeriod(f, window("2027-03-31T00:00:00Z")), false, f);
    assert.equal(isDueInPeriod(f, window("2027-12-31T00:00:00Z"), { isFinalPeriod: true }), true, f);
    assert.equal(expectedInPeriod({ frequency: f, window: window("2027-03-31T00:00:00Z"), hasValue: true }), true, f);
  }
});

test("a cadence is read as before, and text that names nothing we know still means every period", () => {
  assert.equal(frequencyKind("Monthly"), "PERIODIC");
  assert.equal(isDueInPeriod("Monthly", window("2027-02-28T00:00:00Z")), true);
  assert.equal(isDueInPeriod("Quarterly", window("2027-02-28T00:00:00Z")), false);
  assert.equal(isDueInPeriod("Quarterly", window("2027-03-31T00:00:00Z")), true);
  assert.equal(isDueInPeriod("Weekly", window("2027-02-28T00:00:00Z")), true);
  assert.equal(isDueInPeriod("whenever the team can", window("2027-02-28T00:00:00Z")), true);
});

test("a library indicator goes under the result whose wording fits it, and under none when nothing fits", () => {
  const wash = BUILT_IN_INDICATORS.find((e) => e.id === "EDU-04");
  const nodes = [
    { level: "OUTPUT", title: "Water supply facilities are built, repaired and kept working" },
    { level: "OUTPUT", title: "Toilets are built, safe and used" },
  ];
  assert.equal(pickNodeFor(wash, nodes, BUILT_IN_CONTENT[wash.sectorId].logframe)?.title, "Toilets are built, safe and used", "the better fit wins, not the first result at the level");
  const health = BUILT_IN_INDICATORS.find((e) => e.level === "OUTPUT" && e.sectorId === "HEALTH");
  assert.equal(pickNodeFor(health, nodes, BUILT_IN_CONTENT[health.sectorId].logframe), null, "no fit means the person chooses");
  assert.equal(pickNodeFor(health, [], BUILT_IN_CONTENT[health.sectorId].logframe), null);
});
