import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_PRESETS, pagePresetById, setPagePreset, frameFromCells, cellsFromFrame, freeFrameProblems, customSize, snapMove, resizeFrame, rotateFrame, stackOrder, placeOnPage, targetsFor,
  BREAKPOINTS, breakpointFor, layoutAt, setBreakpointBounds, breakpointProblems, layoutStack, diffCanvases, isEmptyDiff, describeDiff, mergeCanvases, resolveConflicts,
  blankCanvas, addBlock, moveBlock, updateProps, removeBlock, addPage, moveBlockToPage, canvasStructureProblems,
} from "../dist/index.js";

const ok = (r) => { assert.equal(r.ok, true, r.ok ? "" : r.reason); return r.canvas; };
function base() {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  for (const id of ["a", "b", "c"]) c = ok(addBlock(c, "page-1", { id, kind: "TEXT", props: { text: id } }));
  return c;
}
const blk = (c, id) => c.pages.flatMap((p) => p.blocks).find((b) => b.id === id);

test("page presets: unique, print sizes are right, social and slide sizes are standard", () => {
  assert.equal(new Set(PAGE_PRESETS.map((p) => p.id)).size, PAGE_PRESETS.length);
  assert.deepEqual(pagePresetById("A4_PORTRAIT").size, { w: 794, h: 1123 });
  assert.deepEqual(pagePresetById("SLIDE_16_9").size, { w: 1280, h: 720 });
  assert.deepEqual(pagePresetById("SOCIAL_STORY").size, { w: 1080, h: 1920 });
  assert.equal(pagePresetById("DASHBOARD").size, null);
  assert.ok(PAGE_PRESETS.filter((p) => p.family === "PRINT").every((p) => p.bleed > 0));
  assert.equal(customSize(50, 500), "A page is between 100 and 6000 px each way.");
  assert.deepEqual(customSize(800, 600), { w: 800, h: 600 });
});

test("going to a free page gives every block a pixel frame; going back snaps to cells; nothing is lost either way", () => {
  const c = base();
  const free = ok(setPagePreset(c, "page-1", "A4_PORTRAIT"));
  const page = free.pages[0];
  assert.equal(page.mode, "FREE");
  assert.ok(page.blocks.every((b) => b.free && b.free.w > 0));
  assert.deepEqual(canvasStructureProblems(free), []);
  const back = ok(setPagePreset(free, "page-1", "DASHBOARD"));
  assert.equal(back.pages[0].mode, "GRID");
  assert.deepEqual(back.pages[0].blocks.map((b) => b.bounds), c.pages[0].blocks.map((b) => b.bounds), "a round trip returns the same cells");
  assert.equal(back.pages[0].blocks.some((b) => b.free), false);
  assert.equal(setPagePreset(c, "page-1", "NOPE").reason, "That page size is not one the product knows.");
  const a4 = pagePresetById("A4_PORTRAIT");
  const slide = ok(setPagePreset(free, "page-1", "SLIDE_16_9"));
  assert.ok(slide.pages[0].blocks[0].free.w < a4.size.w * 2, "frames are scaled to the new page");
  const f = frameFromCells(blk(c, "a"), a4.size, a4.margin);
  assert.deepEqual(cellsFromFrame(f, a4.size, a4.margin), blk(c, "a").bounds);
});

test("free frames are checked: size, position, rotation", () => {
  const page = { w: 800, h: 600 };
  assert.deepEqual(freeFrameProblems({ x: 10, y: 10, w: 100, h: 50 }, page), []);
  assert.ok(freeFrameProblems({ x: 10, y: 10, w: 2, h: 50 }, page).length > 0);
  assert.ok(freeFrameProblems({ x: 5000, y: 10, w: 100, h: 50 }, page).some((p) => /partly on the page/.test(p)));
  assert.ok(freeFrameProblems({ x: 0, y: 0, w: 100, h: 50, rot: 400 }, page).some((p) => /Rotation/.test(p)));
  assert.ok(freeFrameProblems({ x: NaN, y: 0, w: 100, h: 50 }, page).length === 1);
});

test("snapping moves a frame onto a nearby guide, never farther than the threshold, and reports the guide", () => {
  const page = { w: 800, h: 600 };
  const near = snapMove({ x: 47, y: 200, w: 100, h: 50 }, page, 48, []);
  assert.equal(near.frame.x, 48);
  assert.ok(near.guides.some((g) => g.axis === "x" && g.kind === "MARGIN"));
  const far = snapMove({ x: 80, y: 200, w: 100, h: 50 }, page, 48, []);
  assert.equal(far.frame.x, 80);
  const other = snapMove({ x: 303, y: 400, w: 100, h: 50 }, page, 48, [{ x: 300, y: 100, w: 200, h: 80 }]);
  assert.equal(other.frame.x, 300, "snaps to another block's edge");
  const centre = snapMove({ x: 348, y: 10, w: 100, h: 50 }, page, 0, []);
  assert.equal(centre.frame.x, 350, "snaps its centre to the page centre");
  assert.ok(targetsFor(page, 48, []).xs.length === 5);
});

test("resize by handles keeps the opposite edge, the minimum size and, when asked, the ratio; rotation is whole degrees", () => {
  const f = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(resizeFrame(f, "E", 50, 0), { ...f, w: 250 });
  assert.deepEqual(resizeFrame(f, "W", 50, 0), { ...f, x: 150, w: 150 });
  assert.equal(resizeFrame(f, "E", -500, 0).w, 8);
  const r = resizeFrame(f, "SE", 100, 0, true);
  assert.equal(r.w / r.h, 2);
  assert.equal(rotateFrame(f, 47, true).rot, 45);
  assert.equal(rotateFrame(f, 190).rot, -170);
});

test("stacking order renumbers without ties; placing on the page centres and fills within margins", () => {
  const frames = [{ id: "a", z: 0 }, { id: "b", z: 1 }, { id: "c", z: 2 }];
  assert.deepEqual(stackOrder(frames, "a", "FRONT").map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(stackOrder(frames, "c", "BACK").map((x) => x.id), ["c", "a", "b"]);
  assert.deepEqual(stackOrder(frames, "b", "FORWARD").map((x) => x.id), ["a", "c", "b"]);
  assert.deepEqual(stackOrder(frames, "b", "BACKWARD").map((x) => x.id), ["b", "a", "c"]);
  assert.deepEqual(stackOrder(frames, "a", "FRONT").map((x) => x.z), [0, 1, 2]);
  assert.equal(placeOnPage({ x: 0, y: 0, w: 100, h: 50 }, { w: 800, h: 600 }, 48, "CENTRE_X").x, 350);
  assert.deepEqual(placeOnPage({ x: 0, y: 0, w: 1, h: 1 }, { w: 800, h: 600 }, 48, "FILL_PAGE"), { x: 48, y: 48, w: 704, h: 504 });
});

test("breakpoints: by width, desktop is the stored place, tablet pairs half-width blocks, phone stacks one per row, empty blocks close their row", () => {
  assert.deepEqual([1200, 800, 400].map(breakpointFor), ["DESKTOP", "TABLET", "PHONE"]);
  assert.deepEqual(BREAKPOINTS, ["DESKTOP", "TABLET", "PHONE"]);
  let c = base();
  c = { ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b, i) => ({ ...b, bounds: { x: (i % 2) * 6, y: Math.floor(i / 2) * 2, w: 6, h: 2 } })) })) };
  const blocks = c.pages[0].blocks;
  assert.deepEqual(layoutAt(blocks, "DESKTOP").map((p) => p.bounds), blocks.map((b) => b.bounds));
  const tablet = layoutAt(blocks, "TABLET");
  assert.deepEqual(tablet.map((p) => [p.bounds.x, p.bounds.y, p.bounds.w]), [[0, 0, 3], [3, 0, 3], [0, 2, 3]]);
  const phone = layoutAt(blocks, "PHONE");
  assert.deepEqual(phone.map((p) => [p.bounds.x, p.bounds.y, p.bounds.w]), [[0, 0, 1], [0, 2, 1], [0, 4, 1]]);
  assert.deepEqual(layoutAt(blocks, "PHONE", (b) => b.id === "b").map((p) => p.bounds.y), [0, 2], "an empty block closes its row");
  const own = setBreakpointBounds(blocks[0], "PHONE", { x: 0, y: 0, w: 1, h: 5 });
  assert.equal(layoutAt([own, ...blocks.slice(1)], "PHONE")[0].bounds.h, 5);
  assert.deepEqual(breakpointProblems(setBreakpointBounds(blocks[0], "TABLET", { x: 4, y: 0, w: 4, h: 1 })), ["The tablet place is outside the 6-column layout."]);
});

test("auto-layout stacks in a row or column with a gap and wraps at the limit", () => {
  const kids = [{ id: "a", w: 100, h: 40 }, { id: "b", w: 100, h: 60 }, { id: "c", w: 100, h: 30 }];
  const row = layoutStack(kids, { direction: "ROW", gap: 10, padding: 8 });
  assert.deepEqual(row.items.map((i) => i.x), [8, 118, 228]);
  assert.deepEqual(row.size, { w: 336, h: 76 });
  const col = layoutStack(kids, { direction: "COLUMN", gap: 10, padding: 8 });
  assert.deepEqual(col.items.map((i) => i.y), [8, 58, 128]);
  const wrapped = layoutStack(kids, { direction: "ROW", gap: 10, padding: 8, wrap: true, limit: 250 });
  assert.deepEqual(wrapped.items.map((i) => [i.x, i.y]), [[8, 8], [118, 8], [8, 78]]);
});

test("a diff names added, removed, moved and changed blocks, pages and settings", () => {
  const a = base();
  assert.equal(isEmptyDiff(diffCanvases(a, a)), true);
  let b = ok(updateProps(a, "a", { text: "changed" }));
  b = ok(removeBlock(b, "c"));
  b = ok(addBlock(b, "page-1", { id: "d", kind: "DIVIDER" }));
  b = ok(addPage(b, { id: "page-2", title: "Two" }));
  b = { ...b, title: "New title" };
  const d = diffCanvases(a, b);
  assert.deepEqual(d.blocks.map((x) => [x.blockId, x.change]).sort(), [["a", "CHANGED"], ["c", "REMOVED"], ["d", "ADDED"]]);
  assert.deepEqual(d.blocks.find((x) => x.blockId === "a").fields, ["props"]);
  assert.deepEqual(d.pages, [{ pageId: "page-2", change: "ADDED" }]);
  assert.deepEqual(d.meta, ["title"]);
  const moved = ok(moveBlockToPage(ok(addPage(a, { id: "page-2", title: "Two" })), "a", "page-2"));
  assert.ok(diffCanvases(a, moved).blocks.find((x) => x.blockId === "a").fields.includes("bounds"));
  assert.ok(describeDiff(d, (id) => `block ${id}`).includes("Added block d"));
});

test("a merge keeps both people's edits to different blocks and different fields, and reports real conflicts", () => {
  const b = base();
  const mine = ok(updateProps(b, "a", { text: "mine" }));
  const theirs = ok(updateProps(ok(moveBlock(b, "b", 6, 0)), "c", { text: "theirs" }));
  const r = mergeCanvases(b, mine, theirs);
  assert.deepEqual(r.conflicts, []);
  assert.equal(blk(r.canvas, "a").props.text, "mine");
  assert.equal(blk(r.canvas, "c").props.text, "theirs");
  assert.equal(blk(r.canvas, "b").bounds.x, 6);
  assert.deepEqual(canvasStructureProblems(r.canvas), []);

  const clash = mergeCanvases(b, mine, ok(updateProps(b, "a", { text: "theirs on a" })));
  assert.deepEqual(clash.conflicts, [{ blockId: "a", kind: "FIELD", fields: ["props"] }]);
  assert.equal(blk(clash.canvas, "a").props.text, "mine", "a conflict leaves mine in place");

  const sameChange = mergeCanvases(b, mine, mine);
  assert.deepEqual(sameChange.conflicts, [], "the same change on both sides is not a conflict");
});

test("added, removed and removed-versus-changed blocks merge or conflict as they should", () => {
  const b = base();
  const theirsAdd = ok(addBlock(b, "page-1", { id: "n", kind: "DIVIDER" }));
  assert.ok(blk(mergeCanvases(b, b, theirsAdd).canvas, "n"));
  const theirsRemove = ok(removeBlock(b, "b"));
  const r = mergeCanvases(b, b, theirsRemove);
  assert.equal(blk(r.canvas, "b"), undefined);
  assert.deepEqual(r.taken.includes("b"), true);
  const mineChanged = ok(updateProps(b, "b", { text: "edited" }));
  const c = mergeCanvases(b, mineChanged, theirsRemove);
  assert.deepEqual(c.conflicts, [{ blockId: "b", kind: "REMOVED_VS_CHANGED", fields: ["props"] }]);
  assert.ok(blk(c.canvas, "b"), "the block is kept until the person decides");
  const theirsChanged = ok(updateProps(b, "b", { text: "theirs" }));
  const d = mergeCanvases(b, ok(removeBlock(b, "b")), theirsChanged);
  assert.deepEqual(d.conflicts, [{ blockId: "b", kind: "REMOVED_VS_CHANGED", fields: ["props"] }]);
  const chosen = resolveConflicts(mergeCanvases(b, mine(b), ok(updateProps(b, "a", { text: "theirs on a" }))).canvas, ok(updateProps(b, "a", { text: "theirs on a" })), { a: "THEIRS" });
  assert.equal(blk(chosen, "a").props.text, "theirs on a");
  function mine(x) { return ok(updateProps(x, "a", { text: "mine" })); }
});

test("canvas-level fields merge when only one side changed them", () => {
  const b = base();
  const r = mergeCanvases(b, b, { ...b, title: "Renamed by them", themeId: "OCHA_BLUE" });
  assert.equal(r.canvas.title, "Renamed by them");
  assert.equal(r.canvas.themeId, "OCHA_BLUE");
  const both = mergeCanvases(b, { ...b, title: "Mine" }, { ...b, title: "Theirs" });
  assert.equal(both.canvas.title, "Mine", "when both changed it, mine stays");
});
