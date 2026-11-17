import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOUR_STEPS } from "../../src/features/tour/domain/tour-steps.ts";
import { TOUR_CHROME, TOUR_STEP_WORDS, localizedStep, tourChrome } from "../../src/features/tour/domain/tour-copy.ts";

/** The in-app Academy tour (Version 4.01): steps that match the product, every one anchored to a real element, in four languages. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? sources(f) : /\.tsx?$/.test(n) ? [f] : []; });
}
const all = sources(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n");

test("every step's target is a data-tour-id that exists in the app", () => {
  for (const s of TOUR_STEPS) {
    const id = s.targetSelector.match(/data-tour-id="([^"]+)"/)?.[1];
    assert.ok(id, `${s.id}: selector must be a data-tour-id`);
    assert.ok(all.includes(`data-tour-id="${id}"`), `${s.id}: no element has data-tour-id="${id}"`);
  }
});

test("the tour covers entry, the plan and the Data Center, and a step with a period in its route comes after a period exists", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  for (const id of ["work-plan", "entry-sheet", "data-center"]) assert.ok(ids.includes(id), id);
  assert.ok(ids.indexOf("reporting-period") < ids.indexOf("entry-sheet"));
  assert.ok(ids.indexOf("evidence") < ids.indexOf("data-center"));
});

test("French, Spanish and Arabic cover every step and the same chrome placeholders", () => {
  const en = TOUR_CHROME.en!; const ph = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const locale of ["fr", "es", "ar"] as const) {
    assert.deepEqual(Object.keys(TOUR_STEP_WORDS[locale]).sort(), TOUR_STEPS.map((s) => s.id).sort(), locale);
    for (const w of Object.values(TOUR_STEP_WORDS[locale])) assert.ok(w.title.length > 3 && w.body.length > 30, locale);
    for (const [k, v] of Object.entries(TOUR_CHROME[locale]!)) {
      assert.equal(ph(v), ph(en[k as keyof typeof en]), `${locale}.${k}`);
      assert.notEqual(v, en[k as keyof typeof en], `${locale}.${k} still English`);
    }
  }
});

test("a language we do not offer reads English, and the rule block keeps its wording", () => {
  const step = TOUR_STEPS.find((s) => s.rule)!;
  assert.deepEqual(localizedStep(step, "de"), step);
  assert.deepEqual(localizedStep(step, "fr").rule, step.rule);
  assert.equal(tourChrome("de"), TOUR_CHROME.en);
});
