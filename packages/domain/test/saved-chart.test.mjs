import assert from "node:assert/strict";
import test from "node:test";
import { pushChartVersion, MAX_CHART_VERSIONS, canEditSavedChart, canSeeSavedChart } from "../dist/index.js";

const v = (n, spec = { kind: "BAR" }) => ({ at: `2026-10-${String(n).padStart(2, "0")}T08:00:00.000Z`, by: "amina", name: `v${n}`, spec });

test("the replaced version goes to the front, newest first, and the list keeps the last ten", () => {
  let list = [];
  for (let i = 1; i <= 14; i += 1) list = pushChartVersion(list, v(i), { name: `v${i + 1}`, spec: { kind: "LINE" } });
  assert.equal(list.length, MAX_CHART_VERSIONS);
  assert.equal(list[0].name, "v14");
  assert.equal(list.at(-1).name, "v5");
});

test("a save that changes nothing adds no version; a changed name or spec does", () => {
  const list = [v(1)];
  assert.deepEqual(pushChartVersion(list, v(2), { name: "v2", spec: { kind: "BAR" } }), list);
  assert.equal(pushChartVersion(list, v(2), { name: "Renamed", spec: { kind: "BAR" } }).length, 2);
  assert.equal(pushChartVersion(list, v(2), { name: "v2", spec: { kind: "BAR", title: "x" } }).length, 2);
  assert.notEqual(pushChartVersion(list, v(2), { name: "x", spec: {} }), list, "the input list is never changed");
  assert.equal(list.length, 1);
});

test("a saved chart is seen and changed by the dashboards' rules", () => {
  const mine = { scope: "MINE", ownerId: "a", projectId: "p" };
  const shared = { scope: "PROJECT", ownerId: "a", projectId: "p" };
  assert.equal(canSeeSavedChart(mine, { userId: "b" }), false);
  assert.equal(canSeeSavedChart(shared, { userId: "b" }), true);
  assert.equal(canEditSavedChart(mine, { userId: "b", canManageShared: true }), false);
  assert.equal(canEditSavedChart(shared, { userId: "b", canManageShared: true }), true);
  assert.equal(canEditSavedChart(shared, { userId: "b", canManageShared: false }), false);
});
