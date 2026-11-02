// Phase 38.1: the wizard's rail, gap sentences and copy. Pure; the rules themselves are tested in the domain.
import test from "node:test";
import assert from "node:assert/strict";
import { REQUIREMENT_CODES, SECTORS, SLIDE_KEYS } from "@donordesk/domain";
import { PCW_SLIDES, REQUIREMENT_SENTENCES } from "../../src/features/project-setup/pcw/copy.ts";
import { SECTOR_OPTIONS, firstOpenSlide, neighbourSlide, railEntries, sentenceFor, slideGaps } from "../../src/features/project-setup/pcw/domain/pcw-view.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const progress = (open: Record<string, number>) => SLIDE_KEYS.map((slide) => ({ slide, total: 1, open: open[slide] ?? 0, complete: (open[slide] ?? 0) === 0 }));
const view = (open: Record<string, number>, inbox: Array<{ key: string; slide: string; code: string; params?: Record<string, string | number> }> = []) =>
  ({ id: "x", status: "READY", updatedAt: "", extras: {}, results: [], inbox: inbox.map((i) => ({ ...i, status: "OPEN" })), progress: progress(open) }) as never;

test("every requirement code has a sentence, and every slide has a name and a lead", () => {
  assert.deepEqual(Object.keys(REQUIREMENT_SENTENCES).sort(), [...REQUIREMENT_CODES].sort());
  assert.deepEqual(Object.keys(PCW_SLIDES), [...SLIDE_KEYS]);
});

test("no sentence shows a code, an id or a snake_case key", () => {
  const params = { count: 3, first: "Wells built" };
  const texts = [
    ...REQUIREMENT_CODES.map((c) => REQUIREMENT_SENTENCES[c](params)),
    ...Object.values(PCW_SLIDES).flatMap((s) => [s.label, s.lead]),
  ];
  for (const text of texts) assert.deepEqual(findRawTokens(text), [], text);
});

test("the sector options are the identity context's list, in its order", () => {
  assert.deepEqual([...SECTOR_OPTIONS], [...SECTORS]);
});

test("the rail follows the API's order and says progress in words", () => {
  const rail = railEntries(view({ RESULTS: 2 }));
  assert.equal(rail.length, 10);
  assert.equal(rail.find((r) => r.slide === "RESULTS")!.status, "2 to answer");
  assert.equal(rail.find((r) => r.slide === "START")!.status, "Complete");
});

test("the wizard opens on the first slide with something to answer, else on Launch", () => {
  assert.equal(firstOpenSlide(view({ PLACES: 1, FINANCE: 3 })), "PLACES");
  assert.equal(firstOpenSlide(view({})), "LAUNCH");
});

test("neighbours stop at both ends", () => {
  const v = view({});
  assert.equal(neighbourSlide(v, "START", -1), null);
  assert.equal(neighbourSlide(v, "START", 1), "PROJECT_TEAM");
  assert.equal(neighbourSlide(v, "LAUNCH", 1), null);
});

test("a slide lists only its own gaps, with counts and the first thing named", () => {
  const v = view({ INDICATORS: 1 }, [
    { key: "indicators.owners", slide: "INDICATORS", code: "indicatorWithoutOwner", params: { count: 3, first: "I1" } },
    { key: "places.area", slide: "PLACES", code: "projectAreaMissing" },
  ]);
  const gaps = slideGaps(v, "INDICATORS");
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.text, "Choose who is responsible for indicator I1 and 2 more.");
  assert.equal(sentenceFor({ key: "k", slide: "START", status: "OPEN" } as never), "");
});
