import test from "node:test";
import assert from "node:assert/strict";
import { smartReviewTarget } from "../../src/features/report-editor/application/report-checks.ts";

const where = { projectId: "p1", periodId: "r1", sectionIds: new Set(["s1"]) };

test("a confidentiality item that names no file opens the period's checklist, not the evidence library", () => {
  assert.deepEqual(smartReviewTarget({ action: { type: "review-confidentiality" } }, where), { kind: "href", href: "/projects/p1/compliance?period=r1" });
});

test("a named file opens that file", () => {
  assert.deepEqual(smartReviewTarget({ evidenceId: "e1", action: { type: "review-confidentiality" } }, where), { kind: "href", href: "/projects/p1/evidence/e1" });
});

test("a section item opens its section; unknown section falls back to the library", () => {
  assert.deepEqual(smartReviewTarget({ sectionId: "s1", action: { type: "review-claim" } }, where), { kind: "section", sectionId: "s1" });
  assert.deepEqual(smartReviewTarget({ sectionId: "zz", action: { type: "add-evidence" } }, where), { kind: "href", href: "/projects/p1/evidence" });
});
