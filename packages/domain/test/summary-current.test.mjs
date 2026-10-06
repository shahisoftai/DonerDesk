import assert from "node:assert/strict";
import test from "node:test";
import { staleSynthesisSectionIds } from "../dist/index.js";

const at = (h) => new Date(Date.UTC(2026, 9, 6, h));
const rev = (id, sectionId, n, h, origin = "GENERATION", content = "text") => ({ id, sectionId, revisionNumber: n, content, changeOrigin: origin, createdAt: at(h) });
const sections = (summaryCurrentAt) => [
  { id: "sum", title: "Executive Summary", currentRevisionId: "r-sum", ...(summaryCurrentAt ? { summaryCurrentAt } : {}) },
  { id: "res", title: "Results", currentRevisionId: "r-res2" },
];
const revisions = [rev("r-sum", "sum", 1, 9), rev("r-res1", "res", 1, 8), rev("r-res2", "res", 2, 10, "REGENERATION")];

test("a regenerated section makes the summary stale; confirming it clears that until the next change (25.1)", () => {
  assert.deepEqual(staleSynthesisSectionIds(sections(), revisions), ["sum"]);
  assert.deepEqual(staleSynthesisSectionIds(sections(at(11)), revisions), [], "confirmed after the change");
  const later = [...revisions, rev("r-res3", "res", 3, 12, "REGENERATION")];
  const s = sections(at(11)); s[1].currentRevisionId = "r-res3";
  assert.deepEqual(staleSynthesisSectionIds(s, later), ["sum"], "a change after the confirmation makes it stale again");
});
