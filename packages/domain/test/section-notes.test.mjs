import assert from "node:assert/strict";
import test from "node:test";
import { complianceSectionsOf, sanitizeSectionNotes, parseStoryContext, ReportingPeriod } from "../dist/index.js";

const sec = (id, title, extra = {}) => ({ id, title, ...extra });

test("only a donor template's compliance sections ask for a statement", () => {
  const got = complianceSectionsOf([
    sec("s1", "Executive Summary"), sec("s2", "Environmental Compliance (IEE)"), sec("s3", "Branding and Marking"), sec("s4", "Gender and Inclusion"),
    sec("s5", "Safeguarding"), sec("s6", "Results"), sec("s7", "Safeguarding guidance", { includeInReport: false }), sec("bp:monthly:risks", "Risks and Mitigation"),
  ]);
  assert.deepEqual(got.map((s) => s.key), ["s2", "s3", "s4", "s5"]);
  assert.deepEqual(complianceSectionsOf([]), []);
});

test("notes are bounded and clean", () => {
  assert.deepEqual(sanitizeSectionNotes({ a: "  text  ", b: "", c: 5, [`k${"x".repeat(130)}`]: "no" }), { a: "text" });
  assert.deepEqual(sanitizeSectionNotes(null), {});
  assert.deepEqual(sanitizeSectionNotes([1]), {});
  assert.equal(Object.keys(sanitizeSectionNotes(Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, "x"])))).length, 40);
  assert.equal(sanitizeSectionNotes({ a: "y".repeat(5000) }).a.length, 4000);
});

test("a period keeps notes through story saves, sets and clears one note, and parses them back", () => {
  const p = ReportingPeriod.create({ id: "p", tenantId: "t", projectId: "pr", reportType: "MONTHLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31"), deadline: new Date("2026-02-10") });
  p.setSectionNote("s2", "Waste sorted.");
  p.setSectionNote("s3", "Logo on all signage.");
  assert.deepEqual(p.storyContext.sectionNotes, { s2: "Waste sorted.", s3: "Logo on all signage." });
  p.setSectionNote("s2", "   ");
  assert.deepEqual(p.storyContext.sectionNotes, { s3: "Logo on all signage." });
  assert.deepEqual(parseStoryContext(p.storyContextJson).sectionNotes, { s3: "Logo on all signage." });
  p.setStoryContext({ achievements: "x" });
  assert.equal(p.storyContext.sectionNotes, undefined, "setStoryContext replaces; the story handler re-supplies the notes");
});
