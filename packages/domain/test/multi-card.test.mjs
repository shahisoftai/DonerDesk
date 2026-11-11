import test from "node:test";
import assert from "node:assert/strict";
import { resolveMultiCard, multiCardProblems, computeCount, validateCountQuery, SAMPLE_SHEET } from "../dist/index.js";

const base = { layout: "GRID", columns: 3, includeDraft: false };
const sheet = {
  ...SAMPLE_SHEET,
  cells: [...SAMPLE_SHEET.cells,
    { indicatorId: "a", periodId: "p3", periodValue: "30", cumulativeValue: "40", status: "VERIFIED", breakdown: [{ dimension: "LOCATION", category: "Punjab", value: "12" }, { dimension: "LOCATION", category: "Sindh", value: "0" }] },
  ],
};

test("an indicator figure: latest recorded, total to date, and by place only from what that place recorded", () => {
  const items = [{ source: { kind: "INDICATOR", indicatorId: "a", measure: "PERIOD" } }, { source: { kind: "INDICATOR", indicatorId: "a", measure: "CUMULATIVE" } }];
  const all = resolveMultiCard({ ...base, items }, { sheet });
  assert.deepEqual(all.items.map((i) => i.value), [30, 40]);
  const pun = resolveMultiCard({ ...base, items }, { sheet, place: { key: "punjab", name: "Punjab" } });
  assert.equal(pun.header, "Punjab");
  assert.equal(pun.items[0].value, 12);
  assert.equal(pun.items[1].value, null, "no invented cumulative by place");
  assert.equal(resolveMultiCard({ ...base, items }, { sheet, place: { key: "sindh", name: "Sindh" } }).items[0].value, 0, "a recorded 0 stays 0");
  const ajk = resolveMultiCard({ ...base, items }, { sheet, place: { key: "ajk", name: "AJK" } }).items[0];
  assert.equal(ajk.value, null); assert.equal(ajk.reason, "Not reported");
});

test("drafts are left out unless asked for, then counted", () => {
  const s = { ...SAMPLE_SHEET, cells: [{ indicatorId: "a", periodId: "p3", periodValue: "5", cumulativeValue: "5", status: "DRAFT" }] };
  const items = [{ source: { kind: "INDICATOR", indicatorId: "a", measure: "PERIOD" } }];
  assert.equal(resolveMultiCard({ ...base, items }, { sheet: s }).items[0].value, null);
  const m = resolveMultiCard({ ...base, includeDraft: true, items }, { sheet: s });
  assert.equal(m.items[0].value, 5); assert.equal(m.unverifiedCount, 1);
});

test("counts: distinct, filtered by place and level; unreadable is not 0", () => {
  const facts = { donors: [{ name: "ECHO", placeKeys: ["punjab"] }, { name: "echo", placeKeys: ["sindh"] }, { name: "FCDO", placeKeys: ["sindh"] }], placesWithValues: [{ key: "lahore", level: 2, within: ["punjab"] }, { key: "punjab", level: 1, within: [] }, { key: "karachi", level: 2, within: ["sindh"] }], facilities: [{ key: "f1", type: "OTP", within: ["punjab"] }, { key: "f2", type: "SC", within: ["punjab"] }, { key: "f3", type: "OTP", within: ["sindh"] }] };
  assert.equal(computeCount({ metric: "DONORS" }, facts).value, 2);
  assert.equal(computeCount({ metric: "DONORS", placeKey: "sindh" }, facts).value, 2);
  assert.equal(computeCount({ metric: "PLACES_REACHED", level: 2 }, facts).value, 2);
  assert.equal(computeCount({ metric: "PLACES_REACHED", level: 2, placeKey: "punjab" }, facts).value, 1);
  assert.equal(computeCount({ metric: "FACILITIES", facilityType: "OTP" }, facts).value, 2);
  assert.equal(computeCount({ metric: "FACILITIES", facilityType: "OTP", placeKey: "punjab" }, facts).value, 1);
  assert.equal(computeCount({ metric: "PARTNERS" }, facts).value, null);
  assert.equal(computeCount({ metric: "PARTNERS" }, facts).note, "Not available here");
  assert.equal(computeCount({ metric: "PARTNERS" }, { partners: [] }).note, "Not recorded yet");
});

test("problems: empty, duplicates, wrong options", () => {
  assert.deepEqual(multiCardProblems({ ...base, items: [] }), ["Add at least one figure."]);
  const dup = { source: { kind: "COUNT", metric: "DONORS" } };
  assert.ok(multiCardProblems({ ...base, items: [dup, dup] }).some((p) => /twice/.test(p)));
  assert.ok(validateCountQuery({ metric: "DONORS", level: 2 }));
  assert.equal(validateCountQuery({ metric: "PLACES_REACHED", level: 2 }), null);
});
