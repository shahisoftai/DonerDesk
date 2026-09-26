import assert from "node:assert/strict";
import test from "node:test";
import { autoMapRegions, scoreRegionAgainstSection } from "../dist/index.js";

const section = (over) => ({
  id: over.id,
  title: over.title,
  description: over.description ?? "",
  inputType: over.inputType ?? "NARRATIVE",
  required: true,
  evidenceNeeded: "",
  order: over.order ?? 0,
  reviewStatus: "DRAFT",
});

const sections = [
  section({ id: "s-summary", title: "Executive Summary", order: 0 }),
  section({ id: "s-indicators", title: "Progress Against Indicators", order: 1, inputType: "INDICATOR_TABLE" }),
  section({ id: "s-activities", title: "Activities Completed", order: 2 }),
];

test("autoMapRegions maps a heading to the best-scoring section", () => {
  const regions = [{ id: "h-0001", kind: "HEADING", text: "Executive Summary", order: 0 }];
  const { results } = autoMapRegions(regions, sections);
  assert.equal(results.length, 1);
  assert.equal(results[0].templateSectionId, "s-summary");
  assert.ok(results[0].score > 0);
  assert.equal(results[0].method, "AUTO");
});

test("autoMapRegions leaves a region unmapped when nothing scores above threshold", () => {
  const regions = [{ id: "h-0001", kind: "HEADING", text: "Completely Unrelated Donor Boilerplate", order: 0 }];
  const { results } = autoMapRegions(regions, sections);
  assert.equal(results[0].templateSectionId, undefined);
});

test("autoMapRegions only matches TABLE regions against TABLE/INDICATOR_TABLE sections", () => {
  const regions = [{ id: "t-0001", kind: "TABLE", text: "", order: 1, tableColumns: ["Code", "Indicator", "This period", "Target"] }];
  const { results } = autoMapRegions(regions, sections);
  assert.equal(results[0].templateSectionId, "s-indicators");
});

test("autoMapRegions warns when multiple regions claim the same section", () => {
  const regions = [
    { id: "h-0001", kind: "HEADING", text: "Activities Completed", order: 0 },
    { id: "h-0002", kind: "HEADING", text: "Activities Completed This Period", order: 1 },
  ];
  const { warnings } = autoMapRegions(regions, sections);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /s-activities/);
});

test("scoreRegionAgainstSection gives a prefix-match bonus for numbered donor headings", () => {
  const numbered = { id: "h-0001", kind: "HEADING", text: "1. Executive Summary", order: 0 };
  const plain = { id: "h-0002", kind: "HEADING", text: "Executive Summary", order: 0 };
  const scoreNumbered = scoreRegionAgainstSection(numbered, sections[0]);
  const scorePlain = scoreRegionAgainstSection(plain, sections[0]);
  assert.ok(scoreNumbered >= scorePlain - 0.01, "numbered heading should score at least as well once normalized");
  assert.ok(scoreNumbered > 0.5);
});

test("autoMapRegions is deterministic (same input, same output)", () => {
  const regions = [
    { id: "h-0001", kind: "HEADING", text: "Executive Summary", order: 0 },
    { id: "h-0002", kind: "HEADING", text: "Activities Completed", order: 1 },
  ];
  const a = autoMapRegions(regions, sections);
  const b = autoMapRegions(regions, sections);
  assert.deepEqual(a, b);
});
