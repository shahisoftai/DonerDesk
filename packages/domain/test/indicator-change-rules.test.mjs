import test from "node:test";
import assert from "node:assert/strict";
import { Indicator, checkIndicatorEdit, checkIndicatorMove, decideIndicatorRemoval, defaultBreakdown } from "../dist/index.js";

test("the type is locked once values exist, other edits are always allowed", () => {
  const rows = [
    [{ currentType: "NUMBER", requestedType: "PERCENTAGE", hasValues: true }, false],
    [{ currentType: "NUMBER", requestedType: "PERCENTAGE", hasValues: false }, true],
    [{ currentType: "NUMBER", requestedType: "NUMBER", hasValues: true }, true],
    [{ currentType: "NUMBER", hasValues: true }, true],
  ];
  for (const [facts, allowed] of rows) assert.equal(checkIndicatorEdit(facts).allowed, allowed, JSON.stringify(facts));
});

test("a move stays in the project, is a no-op onto itself and is refused after approval", () => {
  const base = { indicatorProjectId: "p", currentItemId: "a", targetItemId: "b", targetProjectId: "p", usedInApprovedReport: false };
  assert.deepEqual(checkIndicatorMove(base), { allowed: true, changes: true });
  assert.deepEqual(checkIndicatorMove({ ...base, targetItemId: "a" }), { allowed: true, changes: false });
  assert.equal(checkIndicatorMove({ ...base, targetProjectId: undefined }).allowed, false);
  assert.equal(checkIndicatorMove({ ...base, targetProjectId: "other" }).allowed, false);
  assert.equal(checkIndicatorMove({ ...base, usedInApprovedReport: true }).allowed, false);
  // moving onto itself is harmless even when approved
  assert.equal(checkIndicatorMove({ ...base, targetItemId: "a", usedInApprovedReport: true }).allowed, true);
});

test("removal: delete without values, archive with values, refuse after approval", () => {
  assert.equal(decideIndicatorRemoval({ hasValues: false, usedInApprovedReport: false }).outcome, "DELETE");
  assert.equal(decideIndicatorRemoval({ hasValues: true, usedInApprovedReport: false }).outcome, "ARCHIVE");
  assert.equal(decideIndicatorRemoval({ hasValues: true, usedInApprovedReport: true }).outcome, "REFUSE");
  assert.equal(decideIndicatorRemoval({ hasValues: false, usedInApprovedReport: true }).outcome, "REFUSE");
});

test("breakdown is on by default only for counts of people", () => {
  const rows = [
    ["People with safe water", "NUMBER", true],
    ["people", "NUMBER", true],
    ["Households", "NUMBER", true],
    ["children under 5", "NUMBER", true],
    ["water points", "NUMBER", false],
    ["%", "PERCENTAGE", false],
    [undefined, "NUMBER", false],
    ["people", "PERCENTAGE", false],
  ];
  for (const [unit, type, expected] of rows) assert.equal(defaultBreakdown(unit, type), expected, `${unit}/${type}`);
});

test("an indicator can be moved, archived and restored", () => {
  const i = Indicator.create({ id: "i", tenantId: "t", projectId: "p", logframeItemId: "a", code: "C", name: "N", type: "NUMBER", baseline: "", target: "" });
  i.moveTo("b");
  assert.equal(i.logframeItemId, "b");
  assert.throws(() => i.moveTo(""));
  assert.equal(i.isArchived, false);
  i.archive(new Date("2026-10-07"));
  assert.equal(i.isArchived, true);
  i.restore();
  assert.equal(i.isArchived, false);
  assert.equal(i.archivedAt, undefined);
});
