import test from "node:test";
import assert from "node:assert/strict";
import { blankCanvas, addBlock, setContainer, removeBlock, canvasStructureProblems, childrenOf, topLevel, canvasAsDesign, repeatKey, isContainerKind } from "../dist/index.js";

const ok = (r) => { assert.equal(r.ok, true, r.ok ? "" : r.reason); return r.canvas; };
function build() {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  const pageId = c.pages[0].id;
  c = ok(addBlock(c, pageId, { id: "tabs", kind: "TABS" }));
  c = ok(addBlock(c, pageId, { id: "a", kind: "TEXT", props: { text: "In the first tab" } }));
  c = ok(addBlock(c, pageId, { id: "b", kind: "TEXT", props: { text: "In the second tab" } }));
  c = ok(addBlock(c, pageId, { id: "free", kind: "DIVIDER" }));
  return c;
}

test("a block is put inside a container, in a tab, and the page grid no longer lays it out", () => {
  let c = build();
  const free = c.pages[0].blocks.find((b) => b.id === "free").bounds;
  c = ok(setContainer(c, "a", { id: "tabs", tab: 0 }));
  c = ok(setContainer(c, "b", { id: "tabs", tab: 1 }));
  const blocks = c.pages[0].blocks;
  assert.deepEqual(topLevel(blocks).map((b) => b.id).sort(), ["free", "tabs"]);
  assert.deepEqual(childrenOf(blocks, "tabs", 1).map((b) => b.id), ["b"]);
  assert.deepEqual(canvasStructureProblems(c), []);
  assert.ok(isContainerKind("TABS") && !isContainerKind("TEXT"));
  assert.equal(repeatKey("a", "p1"), "a::p1");
  assert.deepEqual(c.pages[0].blocks.find((b) => b.id === "free").bounds.x, free.x);
});

test("a container cannot be held, a missing tab or container is refused, and removing a container sets its blocks free", () => {
  let c = build();
  c = ok(addBlock(c, c.pages[0].id, { id: "g", kind: "GROUP" }));
  assert.match(setContainer(c, "g", { id: "tabs" }).reason, /cannot be put inside another/);
  assert.match(setContainer(c, "a", { id: "tabs", tab: 5 }).reason, /tab does not exist/);
  assert.match(setContainer(c, "a", { id: "nope" }).reason, /not on the page/);
  assert.match(setContainer(c, "a", { id: "free" }).reason, /not on the page/, "a divider holds nothing");
  c = ok(setContainer(c, "a", { id: "tabs", tab: 0 }));
  c = ok(removeBlock(c, "tabs"));
  assert.equal(c.pages[0].blocks.find((b) => b.id === "a").container, undefined);
  assert.deepEqual(canvasStructureProblems(c), []);
  c.pages[0].blocks.find((b) => b.id === "b").container = { id: "ghost" };
  assert.ok(canvasStructureProblems(c).some((p) => /not on the page/.test(p.message)));
});

test("in a file a group and each tab open in place: their names, then what they hold; a repeater is named as screen-only", () => {
  let c = build();
  c = ok(addBlock(c, c.pages[0].id, { id: "rep", kind: "REPEATER" }));
  c = ok(setContainer(c, "a", { id: "tabs", tab: 0 }));
  c = ok(setContainer(c, "b", { id: "tabs", tab: 1 }));
  const { config, skipped } = canvasAsDesign(c);
  const texts = config.sections.map((s) => s.text).filter(Boolean);
  assert.deepEqual(texts, ["Tab 1", "In the first tab", "Tab 2", "In the second tab"]);
  assert.deepEqual(skipped.map((s) => s.kind), ["REPEATER"]);
});
