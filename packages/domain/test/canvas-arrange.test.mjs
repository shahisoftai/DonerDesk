import test from "node:test";
import assert from "node:assert/strict";
import {
  blankCanvas, addBlock, setLocked, selectOne, toggle, extendTo, selectAll, selectInside, selectSameKind, marquee, pruneSelection, boundsOf, EMPTY_SELECTION,
  moveMany, nudge, align, distribute, matchSize, reorder, removeMany, duplicateMany, setFlag, groupBlocks, ungroup, convertBlock, conversionLosses,
  copyBlocks, readPayload, pasteBlocks, CANVAS_COMMANDS, commandEnabled, commandForKey, matchesShortcut, searchCommands, shortcutLabel, startHistory, commit, undo, HISTORY_LIMIT,
  canvasStructureProblems,
} from "../dist/index.js";

const ok = (r) => { assert.equal(r.ok, true, r.ok ? "" : r.reason); return r.canvas; };
/** blocks: [id, kind, x, y, w, h] placed exactly (dividers and text are free-size enough). */
function world(spec) {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  for (const [id, kind] of spec) c = ok(addBlock(c, "page-1", { id, kind, props: kind === "TEXT" ? { text: id } : undefined }));
  return c;
}
const place = (c, bounds) => ({ ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (bounds[b.id] ? { ...b, bounds: bounds[b.id] } : b)) })) });
const page = (c) => c.pages[0];
const at = (c, id) => page(c).blocks.find((b) => b.id === id).bounds;

const base = () => place(world([["a", "TEXT"], ["b", "TEXT"], ["c", "TEXT"], ["d", "TEXT"]]), {
  a: { x: 0, y: 0, w: 3, h: 2 }, b: { x: 4, y: 3, w: 3, h: 2 }, c: { x: 9, y: 6, w: 3, h: 2 }, d: { x: 0, y: 10, w: 12, h: 1 },
});

test("selection: click, toggle, shift-range in reading order, all, same kind, marquee, prune", () => {
  const c = base();
  assert.deepEqual(selectOne("a").ids, ["a"]);
  assert.deepEqual(toggle(c, selectOne("a"), "b").ids, ["a", "b"]);
  assert.deepEqual(toggle(c, { ids: ["a", "b"] }, "a").ids, ["b"]);
  assert.deepEqual(extendTo(c, selectOne("a"), "c").ids, ["a", "b", "c"]);
  assert.deepEqual(extendTo(c, selectOne("c"), "a").ids, ["a", "b", "c"], "the order is the reading order, not the click order");
  assert.deepEqual(selectAll(page(c)).ids, ["a", "b", "c", "d"]);
  assert.deepEqual(selectSameKind(page(c), "a").ids.length, 4);
  assert.deepEqual(marquee(page(c), { x: 3, y: 2, w: 6, h: 3 }).ids, ["b"]);
  assert.deepEqual(marquee(page(c), { x: 3, y: 2, w: 6, h: 3 }, selectOne("a")).ids, ["a", "b"]);
  assert.deepEqual(pruneSelection(c, { ids: ["a", "gone"], anchor: "gone" }), { ids: ["a"], anchor: "a" });
  assert.deepEqual(pruneSelection(c, { ids: ["zzz"] }), EMPTY_SELECTION);
  assert.deepEqual(boundsOf(page(c).blocks.filter((b) => ["a", "b"].includes(b.id))), { x: 0, y: 0, w: 7, h: 5 });
  assert.deepEqual(toggle(c, EMPTY_SELECTION, "nope"), EMPTY_SELECTION);
});

test("move and nudge move the whole group, never past the page, and a no-op is refused", () => {
  const c = base();
  const r = ok(moveMany(c, ["a", "b"], 1, 0));
  assert.deepEqual([at(r, "a").x, at(r, "b").x], [1, 5]);
  assert.equal(moveMany(c, ["a", "c"], 1, 0).reason, "A block cannot leave the page.", "c is at the right edge: nothing moves");
  assert.equal(moveMany(c, ["a"], 0, 0).reason, "Nothing would change.");
  assert.equal(at(ok(nudge(c, ["a"], "DOWN")), "a").y, 1);
  assert.equal(at(ok(nudge(c, ["a"], "RIGHT", true)), "a").x, 3);
  assert.equal(moveMany(c, [], 1, 0).reason, "Select a block first.");
  assert.equal(moveMany(c, ["a", "ghost"], 1, 0).reason, "Select blocks on one page.");
});

test("locked blocks are never moved by a gesture on several: they are named as skipped", () => {
  const c = ok(setLocked(base(), "b", true));
  const r = moveMany(c, ["a", "b"], 1, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.skipped, ["b"]);
  assert.equal(at(r.canvas, "b").x, 4);
  assert.equal(at(r.canvas, "a").x, 1);
  assert.equal(moveMany(c, ["b"], 1, 0).reason, "The selected blocks are locked.");
});

test("align uses the edges of the selection; distribute spaces three or more evenly", () => {
  const c = base();
  const left = ok(align(c, ["a", "b", "c"], "LEFT"));
  assert.deepEqual(["a", "b", "c"].map((i) => at(left, i).x), [0, 0, 0]);
  const right = ok(align(c, ["a", "b", "c"], "RIGHT"));
  assert.deepEqual(["a", "b", "c"].map((i) => at(right, i).x), [9, 9, 9]);
  const centre = ok(align(c, ["a", "c"], "CENTER"));
  assert.equal(at(centre, "a").x, 5);
  assert.equal(align(c, ["a"], "LEFT").reason, "Select at least 2 blocks.");
  const flat = place(c, { a: { x: 0, y: 0, w: 2, h: 2 }, b: { x: 3, y: 0, w: 2, h: 2 }, c: { x: 10, y: 0, w: 2, h: 2 }, d: { x: 0, y: 8, w: 12, h: 1 } });
  const even = ok(distribute(flat, ["a", "b", "c"], "HORIZONTAL"));
  assert.deepEqual(["a", "b", "c"].map((i) => at(even, i).x), [0, 5, 10], "equal gaps of 3 cells");
  assert.equal(distribute(flat, ["a", "b"], "HORIZONTAL").reason, "Select at least 3 blocks.");
});

test("match size copies the reference's size within each block's own limits", () => {
  const c = base();
  const r = ok(matchSize(c, ["a", "d"], "d", "WIDTH"));
  assert.equal(at(r, "a").w, 12);
  assert.equal(at(r, "a").x, 0, "a block that would leave the page is pulled back in");
  assert.equal(matchSize(c, ["a", "b"], "a", "WIDTH").reason, "Nothing would change.");
  assert.equal(matchSize(c, ["a", "b"], "zzz", "WIDTH").reason, "Choose one of the selected blocks to match.");
});

test("reorder changes the page's order (reading order on a grid) and refuses a no-op", () => {
  const c = base();
  const ids = (x) => page(x).blocks.map((b) => b.id);
  assert.deepEqual(ids(ok(reorder(c, ["a"], "FRONT"))), ["b", "c", "d", "a"]);
  assert.deepEqual(ids(ok(reorder(c, ["d"], "BACK"))), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(ok(reorder(c, ["a"], "FORWARD"))), ["b", "a", "c", "d"]);
  assert.deepEqual(ids(ok(reorder(c, ["d"], "BACKWARD"))), ["a", "b", "d", "c"]);
  assert.equal(reorder(c, ["d"], "FRONT").reason, "Nothing would change.");
});

test("remove, duplicate and the lock and hide flags work on selections and keep ids unique", () => {
  const c = base();
  assert.deepEqual(page(ok(removeMany(c, ["a", "b"]))).blocks.map((b) => b.id), ["c", "d"]);
  const copy = ok(duplicateMany(c, ["a", "b"], ["a2", "b2"]));
  assert.equal(page(copy).blocks.length, 6);
  assert.equal(duplicateMany(c, ["a"], ["b"]).reason, "Two blocks share an id.");
  assert.equal(duplicateMany(c, ["a", "b"], ["only-one"]).reason, "Each copy needs its own id.");
  const locked = ok(setFlag(c, ["a", "b"], "locked", true));
  assert.ok(page(locked).blocks.filter((b) => ["a", "b"].includes(b.id)).every((b) => b.style.locked));
  assert.equal(setFlag(locked, ["a"], "locked", true).reason, "Nothing would change.");
  assert.ok(ok(setFlag(locked, ["a", "b"], "locked", false)));
  assert.equal(page(ok(setFlag(c, ["c"], "hidden", true))).blocks.find((b) => b.id === "c").style.hidden, true);
  assert.deepEqual(canvasStructureProblems(copy), []);
});

test("group wraps blocks in a frame that covers them; ungroup gives them back", () => {
  const c = base();
  const g = ok(groupBlocks(c, ["a", "b"], "grp"));
  const holder = page(g).blocks.find((b) => b.id === "grp");
  assert.equal(holder.kind, "GROUP");
  assert.deepEqual(page(g).blocks.filter((b) => b.container?.id === "grp").map((b) => b.id), ["a", "b"]);
  assert.deepEqual(selectInside(page(g), "grp").ids, ["a", "b"]);
  assert.deepEqual(canvasStructureProblems(g), []);
  const back = ok(ungroup(g, "grp"));
  assert.equal(page(back).blocks.some((b) => b.id === "grp" || b.container), false);
  assert.equal(groupBlocks(c, ["a"], "g2").reason, "Select at least 2 blocks to group.");
  assert.equal(groupBlocks(g, ["a", "c"], "g3").reason, "A group holds plain blocks, not other groups or tabs.");
  assert.equal(ungroup(c, "a").reason, "That is not a group.");
});

test("changing a block's kind keeps what both share and names what would be lost before doing it", () => {
  let c = world([["t", "TEXT"]]);
  c = ok(addBlock(c, "page-1", { id: "q", kind: "QUOTE", props: { text: "Hello", by: "Amina" } }));
  const loss = conversionLosses(page(c).blocks.find((b) => b.id === "q"), "TEXT");
  const refused = convertBlock(c, "q", "TEXT");
  if (loss.length > 0) assert.match(refused.reason, /would drop/);
  const forced = ok(convertBlock(c, "q", "TEXT", true));
  assert.equal(page(forced).blocks.find((b) => b.id === "q").kind, "TEXT");
  assert.equal(convertBlock(c, "q", "QUOTE").reason, "Nothing would change.");
  assert.equal(convertBlock(c, "q", "NOT_A_KIND").reason, "This block is not one the product knows.");
  assert.match(convertBlock(ok(groupBlocks(base(), ["a", "b"], "grp")), "grp", "TEXT").reason, /cannot be converted/);
});

test("copy carries definitions only; paste gives new ids, re-checks and refuses what it should", () => {
  const c = base();
  const payload = copyBlocks(c, ["a", "b"]);
  assert.deepEqual(payload.blocks.map((b) => b.bounds), [{ x: 0, y: 0, w: 3, h: 2 }, { x: 4, y: 3, w: 3, h: 2 }], "positions are relative to the selection");
  assert.ok(!JSON.stringify(payload).includes("\"data\""), "no figures travel");
  let n = 0;
  const r = pasteBlocks(c, "page-1", payload, () => `n${++n}`);
  assert.equal(r.ok, true);
  assert.deepEqual(r.pastedIds, ["n1", "n2"]);
  assert.equal(page(r.canvas).blocks.length, 6);
  assert.deepEqual(canvasStructureProblems(r.canvas), []);
  assert.equal(pasteBlocks(c, "nope", payload, () => "x").reason, "That page does not exist.");
  const bound = { ...payload, blocks: [{ ...payload.blocks[0], bindings: [{ projectId: "secret", slot: "project" }] }] };
  assert.match(pasteBlocks(c, "page-1", bound, () => "z", undefined, (p) => p !== "secret").reason, /cannot see/);
  assert.equal(readPayload("not json"), "That is not something copied from a canvas.");
  assert.equal(readPayload(JSON.stringify({ app: "donordesk-canvas", version: 1, blocks: [{ id: "x", kind: "NOPE" }] })), "Part of what was copied is not a block this version knows.");
  assert.equal(typeof readPayload(JSON.stringify(payload)), "object");
  const g = ok(groupBlocks(c, ["a", "b"], "grp"));
  const withHeld = copyBlocks(g, ["grp"]);
  assert.equal(withHeld.blocks.length, 3, "a copied container takes what it holds");
  const pasted = pasteBlocks(g, "page-1", withHeld, (() => { let i = 0; return () => `p${++i}`; })());
  assert.deepEqual(canvasStructureProblems(pasted.canvas), []);
});

test("every command is unique, has a rule and a keyword list, and no two commands share a shortcut", () => {
  const ids = new Set(), keys = new Set();
  for (const cmd of CANVAS_COMMANDS) {
    assert.ok(!ids.has(cmd.id), `duplicate ${cmd.id}`); ids.add(cmd.id);
    assert.ok(cmd.keywords.length > 0);
    if (cmd.shortcut) { assert.ok(!keys.has(cmd.shortcut), `shortcut ${cmd.shortcut} used twice`); keys.add(cmd.shortcut); }
  }
  assert.ok(CANVAS_COMMANDS.length >= 35);
});

test("shortcuts match the keys people press, availability follows the selection, and the palette finds commands by word", () => {
  const state = { selectedCount: 1, selectedIsContainer: false, canUndo: true, canRedo: false, hasClipboard: false };
  assert.equal(commandForKey({ key: "z", ctrlKey: true }, state)?.id, "undo");
  assert.equal(commandForKey({ key: "z", metaKey: true, shiftKey: true }, { ...state, canRedo: true })?.id, "redo");
  assert.equal(commandForKey({ key: "z", ctrlKey: true, shiftKey: true }, state), undefined, "redo is not available");
  assert.equal(commandForKey({ key: "v", ctrlKey: true }, state), undefined, "paste needs something copied");
  assert.equal(commandForKey({ key: "d", ctrlKey: true }, state)?.id, "duplicate");
  assert.equal(commandForKey({ key: "g", ctrlKey: true }, state), undefined, "group needs two blocks");
  assert.equal(commandForKey({ key: "g", ctrlKey: true }, { ...state, selectedCount: 2 })?.id, "group");
  assert.equal(commandForKey({ key: "?", shiftKey: true }, state)?.id, "showShortcuts");
  assert.ok(matchesShortcut("Delete", { key: "Delete" }));
  assert.equal(matchesShortcut("Mod+A", { key: "a" }), false);
  assert.equal(shortcutLabel("Mod+Shift+Z", true), "⌘⇧Z");
  assert.equal(shortcutLabel("Mod+Shift+Z", false), "Ctrl+Shift+Z");
  const nameOf = (c) => c.id;
  const hits = searchCommands("clone", nameOf, state);
  assert.equal(hits[0].id, "duplicate");
  assert.ok(searchCommands("align", nameOf, { ...state, selectedCount: 0 }).every((c) => c.group === "ARRANGE"));
  assert.ok(commandEnabled(CANVAS_COMMANDS.find((c) => c.id === "ungroup"), { ...state, selectedIsContainer: true }));
});

test("history keeps 200 steps, one gesture is one step, and undo restores exactly", () => {
  assert.equal(HISTORY_LIMIT, 200);
  let h = startHistory(base());
  const r = ok(moveMany(h.present, ["a"], 1, 0));
  h = commit(h, r);
  assert.equal(h.past.length, 1);
  assert.equal(commit(h, r).past.length, 1, "no change is not a step");
  assert.deepEqual(undo(h).present, base());
});
