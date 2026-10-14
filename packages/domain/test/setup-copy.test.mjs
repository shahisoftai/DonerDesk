import assert from "node:assert/strict";
import test from "node:test";
import { Indicator, LogframeItem, planLogframeCopy } from "../dist/index.js";

const item = (id, level, parentId, code, title = id) => LogframeItem.create({ id, tenantId: "tenant-a", projectId: "src", level, parentId, code, title: `${title} title` });
const ind = (id, logframeItemId, over = {}) => Indicator.create({ id, tenantId: "tenant-a", projectId: "src", logframeItemId, code: `I-${id}`, name: `${id} name`, type: "NUMBER", baseline: "0", target: "50", unit: "people", responsibleUserId: "someone", ...over });

function plan(items, indicators) {
  let n = 0;
  return planLogframeCopy({ items, indicators, tenantId: "tenant-a", targetProjectId: "dst", newId: () => `new-${++n}`, now: new Date("2027-01-01") });
}

test("the tree is copied with new ids and parents re-pointed", () => {
  const out = plan([item("g", "GOAL", undefined, "1"), item("oc", "OUTCOME", "g", "1.1"), item("op", "OUTPUT", "oc", "1.1.1")], []);
  assert.equal(out.items.length, 3);
  assert.ok(out.items.every((i) => i.projectId === "dst" && i.id.startsWith("new-")));
  const byCode = Object.fromEntries(out.items.map((i) => [i.code, i]));
  assert.equal(byCode["1"].parentId, undefined);
  assert.equal(byCode["1.1"].parentId, byCode["1"].id);
  assert.equal(byCode["1.1.1"].parentId, byCode["1.1"].id);
});

test("indicators follow their logframe item; retired ones and who was responsible stay behind", () => {
  const retired = ind("old", "op");
  retired.archive(new Date());
  const out = plan([item("op", "OUTPUT", undefined, "1")], [ind("a", "op"), retired, ind("orphan", "missing")]);
  assert.equal(out.indicators.length, 1);
  assert.equal(out.skippedArchived, 1);
  const copy = out.indicators[0];
  assert.equal(copy.logframeItemId, out.items[0].id);
  assert.equal(copy.target, "50");
  assert.equal(copy.unit, "people");
  assert.equal(copy.responsibleUserId, undefined);
  assert.equal(copy.projectId, "dst");
});

test("an item whose parent is not in the source becomes a root instead of being lost", () => {
  const out = plan([item("op", "OUTPUT", "gone", "1")], []);
  assert.equal(out.items[0].parentId, undefined);
});
