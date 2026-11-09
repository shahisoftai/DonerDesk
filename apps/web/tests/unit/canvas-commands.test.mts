import assert from "node:assert/strict";
import test from "node:test";
import { CANVAS_COMMANDS, COMMAND_GROUPS, addBlock, blankCanvas, type ArrangeResult, type Canvas, type ClipboardPayload, type Selection } from "@donordesk/domain/contexts/canvas/index.js";
import { COMMAND_HANDLERS, missingHandlers, nudgeSelection, selectByRectangle, type EditorPort } from "../../src/features/canvas/domain/command-handlers.ts";
import { en } from "../../src/features/i18n/messages/en.ts";
import { MESSAGES } from "../../src/features/i18n/messages/index.ts";

const ok = (r: { ok: boolean; canvas?: Canvas; reason?: string }) => { assert.equal(r.ok, true, r.reason); return r.canvas!; };

function fake(selected: string[]) {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  for (const id of ["a", "b", "c"]) c = ok(addBlock(c, "page-1", { id, kind: "TEXT", props: { text: id } }) as never);
  const log: string[] = [];
  let clip: ClipboardPayload | null = null;
  let n = 0;
  const state = { canvas: c, selection: { ids: selected, anchor: selected[0] } as Selection };
  const port: EditorPort = {
    get canvas() { return state.canvas; },
    get page() { return state.canvas.pages[0]!; },
    get selection() { return state.selection; },
    select: (s) => { state.selection = s; log.push(`select:${s.ids.join(",")}`); },
    apply: (r: ArrangeResult) => { if (r.ok) { state.canvas = r.canvas; log.push("apply"); } else log.push(`refused:${r.reason}`); return r.ok; },
    newId: () => `n${++n}`,
    clipboard: { get: () => clip, set: (p) => { clip = p; log.push("clip"); } },
    undo: () => log.push("undo"), redo: () => log.push("redo"), save: () => log.push("save"), preview: () => log.push("preview"),
    view: { zoomBy: (f) => log.push(`zoomBy:${f.toFixed(2)}`), zoomTo: (v) => log.push(`zoomTo:${v}`), toggleGrid: () => log.push("grid"), toggleRulers: () => log.push("rulers") },
    ui: { openPalette: () => log.push("palette"), showShortcuts: () => log.push("shortcuts"), convert: (id) => log.push(`convert:${id}`) },
    canReachProject: () => true,
  };
  return { port, log, state };
}

test("every command in the table has a handler, a name in all four languages and a group name", () => {
  assert.deepEqual(missingHandlers(), []);
  for (const id of Object.keys(COMMAND_HANDLERS)) assert.ok(CANVAS_COMMANDS.some((c) => c.id === id), `handler ${id} has no command`);
  for (const lang of Object.keys(MESSAGES)) {
    const catalogue = MESSAGES[lang as keyof typeof MESSAGES] as Record<string, string>;
    for (const c of CANVAS_COMMANDS) assert.ok(catalogue[`editor.cmd.${c.id}`], `${lang}: no name for ${c.id}`);
    for (const g of COMMAND_GROUPS) assert.ok(catalogue[`editor.group.${g}`], `${lang}: no name for group ${g}`);
  }
  assert.equal(en["editor.cmd.undo"], "Undo");
});

test("delete, cut, duplicate and group act on the selection as one step and update it", () => {
  const d = fake(["a", "b"]);
  COMMAND_HANDLERS.delete!(d.port);
  assert.deepEqual(d.state.canvas.pages[0]!.blocks.map((b) => b.id), ["c"]);
  assert.deepEqual(d.state.selection.ids, []);

  const g = fake(["a", "b"]);
  COMMAND_HANDLERS.group!(g.port);
  assert.ok(g.state.canvas.pages[0]!.blocks.some((b) => b.kind === "GROUP"));
  assert.equal(g.state.selection.ids.length, 1);
  COMMAND_HANDLERS.ungroup!(g.port);
  assert.ok(!g.state.canvas.pages[0]!.blocks.some((b) => b.kind === "GROUP"));

  const u = fake(["a"]);
  COMMAND_HANDLERS.duplicate!(u.port);
  assert.equal(u.state.canvas.pages[0]!.blocks.length, 4);
  assert.deepEqual(u.state.selection.ids, ["n1"], "the copy becomes the selection");

  const x = fake(["a"]);
  COMMAND_HANDLERS.cut!(x.port);
  assert.deepEqual(x.log.slice(0, 2), ["clip", "apply"]);
  COMMAND_HANDLERS.paste!(x.port);
  assert.equal(x.state.canvas.pages[0]!.blocks.length, 3, "cut then paste puts the block back");
});

test("paste with an empty clipboard does nothing; a refused gesture only shows its reason", () => {
  const p = fake(["a"]);
  COMMAND_HANDLERS.paste!(p.port);
  assert.deepEqual(p.log, []);
  const q = fake(["a"]);
  COMMAND_HANDLERS.alignLeft!(q.port);
  assert.match(q.log[0]!, /^refused:Select at least 2 blocks/);
});

test("view, history and ui commands are passed to the port; nudge and the rectangle select use the pure rules", () => {
  const p = fake(["a"]);
  for (const id of ["undo", "redo", "save", "preview", "openPalette", "showShortcuts", "toggleGrid", "toggleRulers", "zoomFit", "zoom100"]) COMMAND_HANDLERS[id]!(p.port);
  assert.deepEqual(p.log, ["undo", "redo", "save", "preview", "palette", "shortcuts", "grid", "rulers", "zoomTo:fit", "zoomTo:1"]);
  COMMAND_HANDLERS.convert!(p.port);
  assert.equal(p.log.at(-1), "convert:a");
  const n = fake(["a"]);
  assert.equal(nudgeSelection(n.port, "DOWN", false), true);
  assert.equal(n.state.canvas.pages[0]!.blocks.find((b) => b.id === "a")!.bounds.y >= 0, true);
  assert.equal(nudgeSelection(fake([]).port, "DOWN", false), false);
  const r = fake([]);
  selectByRectangle(r.port, { x: 0, y: 0, w: 12, h: 100 }, false);
  assert.equal(r.state.selection.ids.length, 3);
});
