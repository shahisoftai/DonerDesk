import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import { TOUR_CHAPTERS, TOUR_ROLES, TOUR_SCENES, scenesForRole, scenesOf, sceneForHash } from "../../src/features/tour/domain/public-tour-scenes.ts";
import { PUBLIC_TOUR_EN, publicTourBundle } from "../../src/features/tour/domain/public-tour-copy.ts";

/** Version 4.01 gate for the public /tour: every scene has words, a real hook in the app, a real feature anchor and a screenshot. */
const WEB = process.cwd();
const SRC = join(WEB, "src");
const manifest = JSON.parse(readFileSync(join(SRC, "features/tour/domain/tour-shots.json"), "utf8")) as { captured: boolean; shots: Record<string, unknown> };

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? sources(f) : /\.(tsx?|mts)$/.test(n) ? [f] : [];
  });
}
const allSource = sources(SRC).map((f) => readFileSync(f, "utf8")).join("\n");
const featureIds = new Set([...readFileSync(join(SRC, "components/landing/platform-content.ts"), "utf8").matchAll(/^\s*id: "([a-z0-9-]+)"/gm)].map((m) => m[1]));

test("every scene has copy and every copy row has a scene", () => {
  assert.deepEqual(Object.keys(PUBLIC_TOUR_EN.scenes).sort(), TOUR_SCENES.map((s) => s.id).sort());
  for (const s of TOUR_SCENES) for (const k of ["title", "body", "note"] as const) assert.ok(PUBLIC_TOUR_EN.scenes[s.id]![k].length > (k === "title" ? 10 : 40), `${s.id}.${k}`);
});

test("scene ids are unique, chapters are all used and in order", () => {
  assert.equal(new Set(TOUR_SCENES.map((s) => s.id)).size, TOUR_SCENES.length);
  const order = TOUR_SCENES.map((s) => TOUR_CHAPTERS.indexOf(s.chapter));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "scenes must follow chapter order");
  for (const c of TOUR_CHAPTERS) assert.ok(scenesOf(c).length >= 2, c);
});

test("every role has a path of at least four scenes", () => {
  for (const r of TOUR_ROLES) assert.ok(scenesForRole(r).length >= 4, r);
});

test("every hook exists in the app", () => {
  for (const s of TOUR_SCENES) assert.ok(allSource.includes(`data-tour-id="${s.hook}"`) || allSource.includes(`data-tour-id: "${s.hook}"`), `${s.id}: no data-tour-id="${s.hook}"`);
});

test("every scene points at a real feature and a known placeholder", () => {
  for (const s of TOUR_SCENES) {
    assert.ok(featureIds.has(s.feature), `${s.id}: /features#${s.feature} does not exist`);
    const unknown = [...s.route.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((p) => !["projectId", "periodId", "canvasId"].includes(p!));
    assert.deepEqual(unknown, [], s.id);
  }
});

test("the words keep to the rules: no raw codes, no demo or personal data, no overclaim", () => {
  const text = JSON.stringify(PUBLIC_TOUR_EN);
  assert.deepEqual(findRawTokens(text.replace(/[{}"]/g, " ")).filter((t) => !/^(M&E|PNG|PDF|SVG)$/.test(t)), []);
  assert.doesNotMatch(text, /DEMO-|\bNajeeb\b|P25-CHECK|shahisoft|ISO 27001 (certified|compliant)|SOC ?2/i);
});

test("a hash names a chapter or a scene", () => {
  assert.equal(sceneForHash("#collect")?.chapter, "collect");
  assert.equal(sceneForHash("#entry-sheet")?.id, "entry-sheet");
  assert.equal(sceneForHash("#nothing"), null);
});

test("the shot manifest names every scene; once captured, every scene has a picture and a spotlight", () => {
  assert.deepEqual(Object.keys(manifest.shots).sort(), TOUR_SCENES.map((s) => s.id).sort());
  if (!manifest.captured) return;
  for (const s of TOUR_SCENES) {
    assert.ok(existsSync(join(WEB, "public/tour", `${s.id}.jpg`)), `${s.id}.jpg is missing`);
    assert.ok(manifest.shots[s.id], `${s.id} has no spotlight`);
  }
});

const placeholders = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const flat = (b: typeof PUBLIC_TOUR_EN): Record<string, string> => ({
  heading: b.heading, lede: b.lede,
  ...Object.fromEntries(Object.entries(b.chapters).flatMap(([k, v]) => [[`chapter.${k}.name`, v.name], [`chapter.${k}.promise`, v.promise]])),
  ...Object.fromEntries(Object.entries(b.roles).flatMap(([k, v]) => [[`role.${k}.name`, v.name], [`role.${k}.line`, v.line]])),
  ...Object.fromEntries(Object.entries(b.ui).map(([k, v]) => [`ui.${k}`, v])),
  ...Object.fromEntries(Object.entries(b.scenes).flatMap(([k, v]) => [[`scene.${k}.title`, v.title], [`scene.${k}.body`, v.body], [`scene.${k}.note`, v.note]])),
});

test("French, Spanish and Arabic carry every key, the same placeholders, and no demo or personal data", () => {
  const en = flat(PUBLIC_TOUR_EN);
  for (const locale of ["fr", "es", "ar"]) {
    const other = flat(publicTourBundle(locale));
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), locale);
    for (const [k, v] of Object.entries(other)) {
      assert.ok(v.trim().length > 0, `${locale} ${k} is empty`);
      assert.equal(placeholders(v), placeholders(en[k]!), `${locale} ${k}: placeholders differ`);
      assert.notEqual(v, en[k], `${locale} ${k} is still English`);
    }
    assert.doesNotMatch(JSON.stringify(other), /DEMO-|Najeeb|P25-CHECK|shahisoft|ISO 27001|SOC ?2/i, locale);
  }
});

test("a language we do not offer reads English", () => {
  assert.equal(publicTourBundle("de"), PUBLIC_TOUR_EN);
});
