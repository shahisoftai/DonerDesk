import test from "node:test";
import assert from "node:assert/strict";
import { canvasAsDesign, blankCanvas } from "../dist/index.js";

const canvasOf = (blocks, over = {}) => ({ ...blankCanvas({ id: "c", title: "Water update", scope: "PROJECT" }), ...over, pages: [{ id: "p1", title: "One", format: "WEB_FLUID", blocks }] });
const b = (id, kind, props, x = 0, y = 0, w = 6, extra = {}) => ({ id, kind, bounds: { x, y, w, h: 2 }, props, bindings: [], ...extra });

test("blocks a file can hold become the renderer's sections in reading order; the rest are named, never dropped silently", () => {
  const { config, skipped } = canvasAsDesign(canvasOf([
    b("b", "REACH", {}, 6, 0), b("a", "TEXT", { text: "Hello" }, 0, 0), b("m", "METRIC", { metric: "ACTIVITIES_TOTAL" }, 0, 2),
    b("k", "KPI", { indicatorId: "i1" }, 6, 2), b("ai", "AI_SUMMARY", { text: "Draft", accepted: false }, 0, 4), b("ok", "AI_MESSAGES", { text: "Checked", accepted: true }, 6, 4),
    b("h", "TEXT", { text: "Hidden" }, 0, 6, 6, { style: { hidden: true } }),
  ]));
  assert.deepEqual(config.sections.map((s) => s.kind), ["TEXT", "REACH", "BIG_NUMBERS", "TEXT"]);
  assert.deepEqual(skipped.map((s) => s.kind).sort(), ["AI_SUMMARY", "METRIC"]);
  assert.equal(config.sections[1].span, 6);
  assert.equal(config.format, "A4_PORTRAIT", "a screen-only page goes on an A4 page in a file");
});

test("a second page starts a new page, a callout becomes words, and a chart a file cannot draw is reported", () => {
  const c = canvasOf([b("t", "CALLOUT", { text: "Rains delayed two sites.", tone: "warn" })]);
  c.pages.push({ id: "p2", title: "Two", format: "WEB_FLUID", blocks: [b("x", "DIVIDER", {}, 0, 0, 12)] });
  const { config, skipped } = canvasAsDesign(c);
  assert.equal(config.sections[0].text, "Rains delayed two sites.");
  assert.equal(config.sections[1].pageBreakBefore, true);
  const none = canvasAsDesign(canvasOf([b("c", "CHART", { spec: { version: 2, kind: "HEATMAP", dataset: { template: "INDICATORS_OVER_TIME", indicatorIds: [] } } })]));
  assert.equal(none.config.sections.length + none.skipped.length, 1);
  assert.equal(skipped.length, 0);
});

test("a file reads one project: a canvas with none of its own takes the first block's, and a block bound to another is named, not mixed in", async () => {
  const { fileProjectOf } = await import("../dist/index.js");
  const bound = (id, projectId) => b(id, "REACH", {}, 0, 0, 6, { bindings: [{ type: "PROJECT", slot: "project", projectId }] });
  const c = canvasOf([bound("a", "p1"), bound("c", "p2")]);
  assert.equal(fileProjectOf(c, undefined), "p1"); assert.equal(fileProjectOf(c, "p9"), "p9");
  const { config, skipped } = canvasAsDesign(c, "p1");
  assert.equal(config.sections.length, 1);
  assert.deepEqual(skipped.map((s) => s.blockId), ["c"]);
});

test("widths snap to the page's grid and an unknown look falls back, so a converted dashboard still makes a file", async () => {
  const { snapSpan } = await import("../dist/index.js");
  assert.deepEqual([1, 2, 3, 5, 7, 10, 11, 12].map(snapSpan), [3, 3, 3, 6, 8, 9, 12, 12].map((n, i) => (i === 3 ? snapSpan(5) : n)));
  assert.equal(snapSpan(5), 6, "a tie between 4 and 6 takes the wider");
  const { config } = canvasAsDesign(canvasOf([b("a", "REACH", {}, 0, 0, 5)], { themeId: "SOME_DASHBOARD_LOOK" }));
  assert.equal(config.themeId, "DEFAULT"); assert.equal(config.sections[0].span, 6);
});
