import assert from "node:assert/strict";
import test, { before } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEsbuild } from "../harness/esbuild-loader.mjs";

const web = resolve(import.meta.dirname, "../..");
let render: (el: unknown) => string;
let h: (type: unknown, props: unknown, ...children: unknown[]) => unknown;
let ContainerView: unknown;

// Bundled once with React so the real container component is rendered to static markup.
before(async () => {
  const esbuild = await loadEsbuild();
  const out = await esbuild.build({
    stdin: { contents: `export { ContainerView } from "./src/features/canvas/presentation/ContainerView.tsx"; export { renderToStaticMarkup } from "react-dom/server"; export { createElement } from "react";`, resolveDir: web, loader: "ts" },
    bundle: true, format: "esm", platform: "node", target: "node20", write: false, jsx: "automatic", logLevel: "error", alias: { "@": resolve(web, "src") },
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  });
  const file = join(mkdtempSync(join(tmpdir(), "canvas-containers-")), "bundle.mjs");
  writeFileSync(file, out.outputFiles[0]!.text);
  const mod = await import(pathToFileURL(file).href);
  render = mod.renderToStaticMarkup; h = mod.createElement; ContainerView = mod.ContainerView;
});

const blk = (id: string, kind: string, props: unknown, container?: { id: string; tab?: number }, x = 0) => ({ id, kind, bounds: { x, y: 0, w: 6, h: 2 }, props, bindings: [], ...(container ? { container } : {}) });
const html = (block: ReturnType<typeof blk>, blocks: ReturnType<typeof blk>[], items?: Array<{ key: string; label: string }>, editing = false) =>
  render(h(ContainerView, { block, blocks, items, editing, renderChild: (c: { id: string }, key?: string) => h("i", { "data-child": `${c.id}${key ? "@" + key : ""}` }) }));

test("tabs show one tab at a time with its titles; a group is a titled frame with what it holds", () => {
  const tabs = blk("t", "TABS", { titles: ["Results", "Plan"] });
  const all = [tabs, blk("a", "TEXT", {}, { id: "t", tab: 0 }), blk("b", "TEXT", {}, { id: "t", tab: 1 })];
  const out = html(tabs, all);
  assert.match(out, /role="tablist"/); assert.match(out, /Results/); assert.match(out, /Plan/);
  assert.match(out, /data-child="a"/); assert.doesNotMatch(out, /data-child="b"/, "only the active tab is drawn");
  const group = blk("g", "GROUP", { title: "Water" });
  const g = html(group, [group, blk("x", "TEXT", {}, { id: "g" })]);
  assert.match(g, /Water/); assert.match(g, /data-child="x"/);
});

test("a repeater draws what it holds once for each item, named; it says so when there is nothing to repeat for or it is not shown here", () => {
  const rep = blk("r", "REPEATER", { over: "PROJECT", limit: 2 });
  const all = [rep, blk("k", "TEXT", {}, { id: "r" })];
  const out = html(rep, all, [{ key: "p1", label: "Kisumu" }, { key: "p2", label: "Siaya" }]);
  assert.match(out, /Kisumu/); assert.match(out, /data-child="k@p1"/); assert.match(out, /data-child="k@p2"/);
  assert.match(html(rep, all, []), /Nothing to repeat for yet/);
  assert.match(html(rep, all, undefined), /A repeat is not shown here/);
  assert.match(html(rep, [rep], [], true), /Put inside/, "while editing, an empty container says how to fill it");
});
