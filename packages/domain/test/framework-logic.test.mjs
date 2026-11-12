import assert from "node:assert/strict";
import test from "node:test";
import { LogframeItem, buildLogframeSnapshot, canonicalSnapshotJson, diffLogframeSnapshots, summarizeLogframeChanges, classifyFrameworkChange, parseLogframeText, planLogframeCopy, MAX_LOGIC_TEXT } from "../dist/index.js";

const make = (o = {}) => LogframeItem.create({ id: "i1", tenantId: "t", projectId: "p", level: "OUTPUT", code: "OUT-1", title: "Trained staff", ...o });

test("52.1: assumptions and rationale are optional, trimmed, and bounded", () => {
  const item = make({ assumptions: "  Staff stay in post  ", rationale: " Trained staff screen more children " });
  assert.equal(item.assumptions, "Staff stay in post");
  assert.equal(item.rationale, "Trained staff screen more children");
  assert.equal(make().assumptions, undefined);
  assert.throws(() => make({ assumptions: "x".repeat(MAX_LOGIC_TEXT + 1) }), /Assumptions can be at most/);
});

test("52.1: edit keeps what is omitted, clears with empty text, and refuses a too-short title", () => {
  const item = make({ assumptions: "A", rationale: "R", description: "D" });
  item.edit({ title: "  Trained health staff " });
  assert.equal(item.title, "Trained health staff");
  assert.equal(item.assumptions, "A");
  item.edit({ assumptions: "", description: " " });
  assert.equal(item.assumptions, undefined);
  assert.equal(item.description, undefined);
  assert.equal(item.rationale, "R");
  assert.throws(() => item.edit({ title: "x" }), /title required/);
  assert.equal(item.level, "OUTPUT");
  assert.equal(item.code, "OUT-1");
});

test("52.1: a framework without the new fields keeps its content hash; with them the snapshot carries them", () => {
  const plain = buildLogframeSnapshot([make()], []);
  assert.equal(canonicalSnapshotJson(plain), JSON.stringify({ items: [{ id: "i1", parentId: null, level: "OUTPUT", code: "OUT-1", title: "Trained staff", description: null, sortOrder: 0 }], indicators: [] }));
  const withLogic = buildLogframeSnapshot([make({ assumptions: "Staff stay", rationale: "Because" })], []);
  assert.equal(withLogic.items[0].assumptions, "Staff stay");
  assert.equal(withLogic.items[0].rationale, "Because");
});

test("52.1: a changed assumption or rationale is a named change to the results, not to the measurement", () => {
  const before = buildLogframeSnapshot([make()], []);
  const after = buildLogframeSnapshot([make({ assumptions: "Staff stay in post", rationale: "Trained staff screen more children" })], []);
  const changes = diffLogframeSnapshots(before, after);
  assert.deepEqual(changes.map((c) => [c.kind, c.field, c.from, c.to]), [
    ["ITEM_CHANGED", "assumptions", "(none)", "Staff stay in post"],
    ["ITEM_CHANGED", "rationale", "(none)", "Trained staff screen more children"],
  ]);
  assert.match(summarizeLogframeChanges(changes), /assumptions changed from \(none\) to Staff stay in post/);
  assert.deepEqual(classifyFrameworkChange(changes).kinds, ["STRUCTURE"]);
});

test("52.1: the sheet's optional Assumptions and Rationale columns are read only when present and filled", () => {
  const text = "Level\tCode\tTitle\tAssumptions\tRationale\nOutcome\t1\tFewer children wasted\tFood is available\tBetter feeding lowers wasting\nOutput\t1.1\tCounselling sessions held\t\t";
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].assumptions, "Food is available");
  assert.equal(rows[0].rationale, "Better feeding lowers wasting");
  assert.equal("assumptions" in rows[1], false);
  const plain = parseLogframeText("Level\tCode\tTitle\nOutcome\t1\tFewer children wasted").rows[0];
  assert.equal("assumptions" in plain, false);
});

test("52.1: copying a project's setup carries the logic of each result", () => {
  const plan = planLogframeCopy({ items: [make({ assumptions: "A", rationale: "R" })], indicators: [], tenantId: "t", targetProjectId: "p2", newId: (() => { let n = 0; return () => `n${++n}`; })(), now: new Date("2026-01-01") });
  assert.equal(plan.items[0].assumptions, "A");
  assert.equal(plan.items[0].rationale, "R");
  assert.equal(plan.items[0].projectId, "p2");
});
