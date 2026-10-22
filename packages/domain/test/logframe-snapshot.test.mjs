import assert from "node:assert/strict";
import test from "node:test";
import { buildLogframeSnapshot, canonicalSnapshotJson, diffLogframeSnapshots, summarizeLogframeChanges, parseSnapshot } from "../dist/index.js";

const item = (o = {}) => ({ id: "i1", level: "OUTPUT", code: "OUT-1", title: "Trained staff", sortOrder: 0, ...o });
const ind = (o = {}) => ({ id: "n1", logframeItemId: "i1", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "100", disaggregationRequired: false, isArchived: false, targetBreakdowns: [], ...o });
const snap = (items = [item()], inds = [ind()]) => buildLogframeSnapshot(items, inds);

test("H-1: the same framework gives byte-identical text whatever order it was read in", () => {
  const a = snap([item({ id: "a", sortOrder: 1 }), item({ id: "b", sortOrder: 0 })], [ind({ id: "x", code: "B" }), ind({ id: "y", code: "A" })]);
  const b = snap([item({ id: "b", sortOrder: 0 }), item({ id: "a", sortOrder: 1 })], [ind({ id: "y", code: "A" }), ind({ id: "x", code: "B" })]);
  assert.equal(canonicalSnapshotJson(a), canonicalSnapshotJson(b));
  assert.deepEqual(parseSnapshot(canonicalSnapshotJson(a)).items.map((i) => i.id), ["b", "a"]);
  assert.equal(parseSnapshot("nope"), null);
});

test("H-1: a moved target is a change that names the indicator, the field and both values", () => {
  const changes = diffLogframeSnapshots(snap(), snap([item()], [ind({ target: "120" })]));
  assert.deepEqual(changes, [{ kind: "INDICATOR_CHANGED", label: "IND-1", field: "target", from: "100", to: "120" }]);
  assert.equal(summarizeLogframeChanges(changes), "1 change: Indicator IND-1: target changed from 100 to 120");
});

test("H-1: additions, removals and retiring are all seen; reordering alone is not a change", () => {
  const before = snap([item(), item({ id: "i2", code: "OUT-2", sortOrder: 1 })], [ind()]);
  const after = snap([item({ sortOrder: 5 })], [ind({ isArchived: true }), ind({ id: "n2", code: "IND-2" })]);
  const kinds = diffLogframeSnapshots(before, after).map((c) => `${c.kind}:${c.label}${c.field ? `:${c.field}` : ""}`).sort();
  assert.deepEqual(kinds, ["INDICATOR_ADDED:IND-2", "INDICATOR_CHANGED:IND-1:retired", "ITEM_REMOVED:OUT-2"]);
});

test("H-1: the first version is all additions; nothing changed means 'No change'", () => {
  assert.equal(diffLogframeSnapshots(null, snap()).map((c) => c.kind).join(), "ITEM_ADDED,INDICATOR_ADDED");
  assert.equal(summarizeLogframeChanges(diffLogframeSnapshots(snap(), snap())), "No change");
});

test("H-1: a long change list is shortened in the title", () => {
  const many = snap([item()], Array.from({ length: 6 }, (_, i) => ind({ id: `n${i}`, code: `IND-${i}` })));
  assert.match(summarizeLogframeChanges(diffLogframeSnapshots(null, many)), /^7 changes: .*; …$/);
});

test("a change to how an indicator is read is told in words, never as a JSON object", () => {
  const semantics = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "CUMULATIVE", status: "CONFIGURED" };
  const [change] = diffLogframeSnapshots(snap(), snap([item()], [ind({ semantics })]));
  assert.equal(change.field, "how it is read");
  assert.equal(change.from, "(none)");
  assert.equal(change.to, "summed across periods; higher is better");
  assert.doesNotMatch(summarizeLogframeChanges([change]), /[{}"]|HIGHER_IS_BETTER|SUM/);
});

test("targets by group, a target schedule and yes/no settings are told in words", () => {
  const breakdowns = [{ dimension: "SEX", category: "Women", value: "150" }, { dimension: "SEX", category: "Men", value: "50" }];
  const schedule = [{ asOf: "2026-06-30", target: "100" }, { asOf: "2026-12-31", target: "200" }];
  const changes = diffLogframeSnapshots(snap(), snap([item()], [ind({ targetBreakdowns: breakdowns, targetSchedule: schedule, disaggregationRequired: true })]));
  const by = Object.fromEntries(changes.map((c) => [c.field, c]));
  assert.equal(by["targets by group"].to, "Women 150, Men 50");
  assert.equal(by["target schedule"].to, "100 by 2026-06-30; 200 by 2026-12-31");
  assert.equal(by["breakdown required"].from, "no");
  assert.equal(by["breakdown required"].to, "yes");
});
