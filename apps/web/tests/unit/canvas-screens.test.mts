import assert from "node:assert/strict";
import test, { before } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BLOCK_KINDS, BLOCK_FIXTURES, SAMPLE_FACTS, definitionFor, themeFor, modelFingerprint } from "@donordesk/domain/contexts/canvas/index.js";
import { loadEsbuild } from "../harness/esbuild-loader.mjs";

const web = resolve(import.meta.dirname, "../..");
let registry: typeof import("../../src/features/canvas/presentation/screen-registry.ts");
let render: (el: unknown) => string;
let React: { createElement: (...a: unknown[]) => unknown };

// The screen renderers are React; the unit tests are plain Node. Bundle them (with React) once and render to static markup.
before(async () => {
  const esbuild = await loadEsbuild();
  const out = await esbuild.build({
    stdin: { contents: `export * from "./src/features/canvas/presentation/screen-registry.ts"; export { renderToStaticMarkup } from "react-dom/server"; export { createElement } from "react";`, resolveDir: web, loader: "ts" },
    bundle: true, format: "esm", platform: "node", target: "node20", write: false, jsx: "automatic", logLevel: "error",
    alias: { "@": resolve(web, "src") },
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  });
  const dir = mkdtempSync(join(tmpdir(), "canvas-screens-"));
  const file = join(dir, "bundle.mjs");
  writeFileSync(file, out.outputFiles[0]!.text);
  const mod = await import(pathToFileURL(file).href);
  registry = mod; render = mod.renderToStaticMarkup; React = mod;
});

const PAINTED = ["BIG_NUMBERS", "PROGRESS_RINGS", "FUNNEL", "REACH", "ACTIVITIES_BY_LOCATION", "LOCATION_RESULTS", "LOCATION_COMPARISON", "DEMOGRAPHICS", "FUNDING", "HERO", "TEXT", "DIVIDER", "BANNER", "KEY_MESSAGES", "LEGEND_NOTES", "QUOTE", "IMAGE", "TIMELINE", "SECTOR_GRID", "THREE_W", "SMALL_MULTIPLES", "RESULTS_CHAIN", "PORTFOLIO_SUMMARY", "PORTFOLIO_TABLE", "PORTFOLIO_HEALTH", "PORTFOLIO_COUNTRIES"] as const;
// Structure blocks are drawn on screen and (where a file can hold them) in print.
const GRAPHIC = ["SHAPE", "ICON"] as const; // pictures with no words of their own: drawn from their settings, described only when a person wrote a description
const STRUCTURE = ["CALLOUT", "AI_SUMMARY", "AI_MESSAGES", "AI_ASK", "GROUP", "TABS", "REPEATER", "FILTER_BAR"] as const;
// Blocks with nothing authored are blank rather than worded (a divider has nothing to say, text is blank until written).
const QUIET_WHEN_EMPTY: readonly string[] = ["TEXT", "DIVIDER"];
// Authored blocks waiting for words show a prompt, not "not yet reported".
const PROMPT_WHEN_EMPTY: readonly string[] = ["HERO", "LEGEND_NOTES", "BANNER", "KEY_MESSAGES", "QUOTE", "IMAGE", "TIMELINE", "THREE_W", "SECTOR_GRID", "BIG_NUMBERS", "FUNNEL"];
const frame = (language = "en") => ({ theme: themeFor("DEFAULT"), size: { w: 12, h: 4 }, language, rtl: language === "ar" });
// With one argument the block's own fixture is used; passing props (and data, even `undefined`) replaces it.
const modelOf = (kind: string, ...given: [] | [unknown] | [unknown, unknown]) => {
  const f = (BLOCK_FIXTURES as Record<string, { props: unknown; data?: unknown }>)[kind]!;
  return definitionFor(kind)!.resolve((given.length >= 1 ? given[0] : f.props) as never, (given.length === 2 ? given[1] : f.data) as never);
};
const html = (kind: string, model: unknown, language = "en") => {
  const Screen = registry.screenRendererFor(kind)!;
  return render(React.createElement(Screen as never, { model, frame: frame(language) }));
};
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

test("the screen renderers are a registry: only known kinds, and the missing list can only shrink", () => {
  for (const kind of Object.keys(registry.SCREEN_RENDERERS)) assert.ok((BLOCK_KINDS as readonly string[]).includes(kind), kind);
  assert.deepEqual([...registry.SCREEN_PENDING, ...Object.keys(registry.SCREEN_RENDERERS)].sort(), [...BLOCK_KINDS].sort());
  assert.deepEqual(Object.keys(registry.SCREEN_RENDERERS).sort(), [...PAINTED, ...GRAPHIC, ...STRUCTURE].sort(), "the same kinds the print side paints");
  const SCREEN_PENDING_MAX = 6; // lower this as the rest are ported
  assert.ok(registry.SCREEN_PENDING.length <= SCREEN_PENDING_MAX);
});

test("every ported screen renders its model, in every language, with no bare placeholder figure", () => {
  for (const kind of PAINTED) for (const language of ["en", "fr", "es", "ar"]) {
    const markup = html(kind, modelOf(kind), language);
    assert.ok(textOf(markup).length > 10 || kind === "DIVIDER", `${kind} ${language} shows something`);
    assert.ok(!/undefined|NaN|\[object/.test(markup), `${kind} ${language} leaks no code value`);
  }
});

test("the screen shows the model's figures, and a gap is worded, not drawn as 0", () => {
  const big = textOf(html("BIG_NUMBERS", modelOf("BIG_NUMBERS")));
  assert.match(big, /120/);                       // people reached
  assert.match(big, /USD 1,?000/);                // finance budget with its currency
  assert.match(big, /Not yet reported/);          // the indicator that is gone
  assert.match(big, /Indicator a/);
  const results = textOf(html("LOCATION_RESULTS", modelOf("LOCATION_RESULTS")));
  assert.match(results, /A Kisumu\s+50\s+25\s+50%/);
  assert.match(results, /A Siaya\s+30\s+Not reported\s+—/, "a place nobody reported is 'Not reported', and has no percent");
  const sector = textOf(html("PROGRESS_RINGS", modelOf("PROGRESS_RINGS")));
  assert.match(sector, /40%/);
});

test("a rate shows its value, never a percent of target", () => {
  const rings = textOf(html("PROGRESS_RINGS", modelOf("PROGRESS_RINGS", { indicatorIds: ["r"] })));
  assert.match(rings, /70%/);
  assert.match(rings, /Latest/);
  assert.ok(!/ \/ /.test(rings), "no 'value / target' line for a rate");
});

test("a block with nothing to show says so with the reason", () => {
  for (const kind of PAINTED.filter((k) => !QUIET_WHEN_EMPTY.includes(k))) {
    const markup = html(kind, modelOf(kind, {}, undefined));
    const words = textOf(markup);
    if (PROMPT_WHEN_EMPTY.includes(kind)) { assert.ok(/data-state="prompt"/.test(markup), `${kind} asks for words`); assert.ok(!/Not yet reported/.test(words), `${kind} is not missing data`); assert.match(words, /\S{3,}/); continue; }
    assert.match(words, /Not yet reported/, `${kind} says it has nothing`);
    assert.ok(/data-state="nothing"/.test(markup));
  }
});

test("notes the model carries reach the screen (unverified figures, rows cut)", () => {
  const funding = textOf(html("FUNDING", modelOf("FUNDING")));
  assert.match(funding, /Some figures are not verified yet\./);
  assert.match(funding, /not verified yet/i);
  const demo = textOf(html("DEMOGRAPHICS", modelOf("DEMOGRAPHICS")));
  assert.match(demo, /Female 70 \(58%\)/);
  assert.match(demo, /Under 5/);
});

test("the screen and print read the same model: it is the same function and the same data", () => {
  for (const kind of PAINTED) assert.equal(modelFingerprint(modelOf(kind)), modelFingerprint(definitionFor(kind)!.resolve(structuredClone(BLOCK_FIXTURES[kind].props) as never, structuredClone(BLOCK_FIXTURES[kind].data ?? undefined) as never)), kind);
  assert.equal(SAMPLE_FACTS.reach.overallUnique, 120);
});

test("an Arabic page renders right to left friendly markup: no physical left/right classes in the new screens", () => {
  for (const kind of PAINTED) assert.ok(!/(?:text-left|text-right|\bml-|\bmr-|\bpl-|\bpr-)/.test(html(kind, modelOf(kind), "ar")), kind);
});

test("authored blocks show what was written, nothing invented", () => {
  assert.match(textOf(html("KEY_MESSAGES", modelOf("KEY_MESSAGES"))), /1 Boreholes now serve more homes\./);
  const quote = html("QUOTE", modelOf("QUOTE"));
  assert.match(textOf(quote), /“The water is close now\.”\s+— A mother in Kisumu/);
  assert.match(textOf(html("THREE_W", modelOf("THREE_W"))), /Water NGO\s+Drilling\s+●?\s*1 organizations/i);
  assert.match(textOf(html("TIMELINE", modelOf("TIMELINE"))), /2026-01-15\s+Boreholes drilled/);
  assert.match(textOf(html("SECTOR_GRID", modelOf("SECTOR_GRID"))), /Water[\s\S]*Indicator a[\s\S]*40[\s\S]*Not yet reported/, "an indicator that is gone is worded");
  assert.match(textOf(html("LEGEND_NOTES", modelOf("LEGEND_NOTES", BLOCK_FIXTURES.LEGEND_NOTES.props, SAMPLE_FACTS))), /Figures to March 2026\.\s+Source: project records · Jan 2026 – Mar 2026 · Indicators A – R/);
  assert.match(textOf(html("TEXT", modelOf("TEXT"))), /Water for Kisumu\s+Boreholes now serve more homes\./);
  assert.match(html("TEXT", modelOf("TEXT")), /<h3[^>]*>Water for Kisumu<\/h3>/, "a line starting '# ' is a heading");
});

test("a picture shows when it can be loaded, and its words when it cannot; text is escaped", () => {
  const model = modelOf("IMAGE");
  const Screen = registry.screenRendererFor("IMAGE")!;
  const withUrl = render(React.createElement(Screen as never, { model, frame: frame(), assetUrl: (id: string) => `/files/${id}` }));
  assert.match(withUrl, /<img src="\/files\/asset-1" alt="People queue at a new borehole\."/);
  const without = html("IMAGE", model);
  assert.ok(!/<img/.test(without));
  assert.match(textOf(without), /People queue at a new borehole\./);
  const hostile = html("KEY_MESSAGES", definitionFor("KEY_MESSAGES")!.resolve({ messages: [{ text: "<script>alert(1)</script>" }] } as never, undefined as never));
  assert.ok(!hostile.includes("<script>"));
});

test("the cover shows who funds it, the title and the subtitle, over its picture when it can be loaded", () => {
  const model = definitionFor("HERO")!.resolve({ title: "Water for Borno", text: "2026" } as never, { ...SAMPLE_FACTS, project: { title: "x", donorName: "EU", country: "Nigeria" }, coverAssetId: "cover" } as never);
  const Screen = registry.screenRendererFor("HERO")!;
  const plain = render(React.createElement(Screen as never, { model, frame: frame() }));
  assert.match(textOf(plain), /EU · Nigeria\s+Water for Borno\s+2026/);
  assert.ok(!/background-image/.test(plain));
  const withPicture = render(React.createElement(Screen as never, { model, frame: frame(), assetUrl: (id: string) => `/files/${id}` }));
  assert.match(withPicture, /background-image:linear-gradient\(rgba\(0,0,0,.5\), rgba\(0,0,0,.5\)\), url\(\/files\/cover\)/);
});

test("shapes and icons draw in the page's theme and are hidden from a screen reader unless described", () => {
  const shape = html("SHAPE", modelOf("SHAPE"));
  assert.match(shape, /<rect /);
  assert.match(shape, /aria-hidden="true"/, "a decorative shape says nothing to a screen reader");
  assert.match(html("SHAPE", modelOf("SHAPE", { shape: "ARROW", tone: "WARN" })), /<path d="M100 25/);
  const outline = html("SHAPE", modelOf("SHAPE", { shape: "ELLIPSE", tone: "NONE", label: "Boundary" }));
  assert.match(outline, /fill="none"/);
  assert.match(outline, /role="img" aria-label="Boundary"/);
  const icon = html("ICON", modelOf("ICON"));
  assert.match(icon, /<path d="M/);
  assert.match(icon, /role="img" aria-label="People reached"/);
  assert.equal(html("ICON", modelOf("ICON", { iconId: "nope", tone: "ACCENT" })), "", "an unknown icon draws nothing, never a placeholder");
});
