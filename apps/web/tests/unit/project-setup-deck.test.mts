// Phase 36.6: the wizard's slide deck, its locks, and the wording of every slide.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREA_KEYS } from "@donordesk/contracts";
import { buildDeck, lockReason, neighbour, openingSlide, progressPercent, slideAt, stepCount } from "../../src/features/project-setup/domain/slide-deck.ts";

const deck = buildDeck();

test("the deck is welcome, document, reading, one slide per area in order, create, done", () => {
  assert.deepEqual(deck.map((s) => s.kind), ["guide", "upload", "reading", ...SETUP_AREA_KEYS.map(() => "area"), "create", "done"]);
  assert.deepEqual(deck.filter((s) => s.kind === "area").map((s) => s.area), [...SETUP_AREA_KEYS]);
  assert.equal(new Set(deck.map((s) => s.key)).size, deck.length, "slide keys are unique");
});

test("steps are numbered from the document slide to the create slide; welcome and done are not steps", () => {
  const numbered = deck.filter((s) => s.step !== null);
  assert.deepEqual(numbered.map((s) => s.step), numbered.map((_, i) => i + 1));
  assert.equal(slideAt(deck, "welcome").step, null);
  assert.equal(slideAt(deck, "done").step, null);
  assert.equal(slideAt(deck, "document").step, 1);
  assert.equal(stepCount(deck), SETUP_AREA_KEYS.length + 3);
});

test("slides are locked until the step before them is done", () => {
  const key = (k: string) => slideAt(deck, k);
  assert.equal(lockReason(key("welcome"), null, false), null);
  assert.equal(lockReason(key("document"), null, false), null);
  assert.match(lockReason(key("reading"), null, false)!, /document first/i);
  assert.match(lockReason(key("facts"), null, false)!, /document first/i);
  assert.match(lockReason(key("facts"), "EXTRACTING", false)!, /still reading/i);
  assert.match(lockReason(key("create"), "FAILED", false)!, /could not be read/i);
  assert.equal(lockReason(key("facts"), "READY", false), null);
  assert.equal(lockReason(key("create"), "PARTIAL", false), null);
  assert.match(lockReason(key("done"), "READY", false)!, /create the project first/i);
  assert.equal(lockReason(key("done"), "READY", true), null, "just created in this visit");
  assert.equal(lockReason(key("done"), "APPLIED", false), null);
});

test("the wizard opens where the person's progress puts them, and never on a locked slide", () => {
  assert.equal(openingSlide(deck, null, null, false), "welcome");
  assert.equal(openingSlide(deck, "document", null, false), "document");
  assert.equal(openingSlide(deck, "facts", null, false), "welcome", "a locked slide asked for falls back");
  assert.equal(openingSlide(deck, null, "EXTRACTING", false), "reading");
  assert.equal(openingSlide(deck, null, "FAILED", false), "reading");
  assert.equal(openingSlide(deck, null, "READY", false), "facts");
  assert.equal(openingSlide(deck, "places", "READY", false), "places");
  assert.equal(openingSlide(deck, null, "APPLIED", false), "done");
  assert.equal(openingSlide(deck, "nonsense", "READY", false), "facts");
});

test("neighbours and progress", () => {
  assert.equal(neighbour(deck, "welcome", -1), undefined);
  assert.equal(neighbour(deck, "welcome", 1)?.key, "document");
  assert.equal(neighbour(deck, "done", 1), undefined);
  assert.equal(progressPercent(deck, "welcome"), 0);
  assert.equal(progressPercent(deck, "done"), 100);
  assert.ok(progressPercent(deck, "places") > progressPercent(deck, "facts"));
});

test("while the project is being created the Create slide stays open and the review steps stay locked", () => {
  const create = deck.find((s) => s.kind === "create")!;
  const area = deck.find((s) => s.kind === "area")!;
  assert.equal(lockReason(create, "APPLYING", false), null);
  assert.notEqual(lockReason(area, "APPLYING", false), null);
});
