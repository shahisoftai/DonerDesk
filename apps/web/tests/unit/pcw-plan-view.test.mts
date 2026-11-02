// Phase 38.5: the Work plan slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { activityOptions, indicatorOptions, indicatorPatch, parseFiles, placeNames, placePatch, planRows, projectWidePatch, share, suggestionTarget, suggestionsByRow } from "../../src/features/project-setup/pcw/domain/plan-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const setup = { placeNames: ["Gulu"], projectWide: false, indicatorCodes: ["I1"], requiredFiles: [], recordsParticipants: false };
const view = {
  logframe: [
    { path: "logframe.0", value: { level: "OUTPUT", code: "OP1", title: "Wells" } },
    { path: "logframe.1", value: { level: "ACTIVITY", code: "A1", title: "Drill" } },
    { path: "logframe.2", value: { level: "ACTIVITY", code: null, title: "No code yet" } },
  ],
  places: [{ value: { name: "Gulu" } }, { value: { name: null } }],
  indicators: [{ value: { code: "I1", title: "Working wells" } }, { value: { code: null, title: "x" } }],
  plan: [{ path: "plan.0", planKey: "code:1.1", value: { title: "Drill wells" } }, { path: "plan.1", planKey: "new:2", value: { title: "New" } }],
  suggestions: [
    { id: "INDICATOR:code:1.1:I1", kind: "INDICATOR", planKey: "code:1.1", value: "I1", reason: "r" },
    { id: "LEAD:code:1.1:ali", kind: "LEAD", planKey: "code:1.1", value: "ali", reason: "r" },
    { id: "PLACE:new:2:Gulu", kind: "PLACE", planKey: "new:2", value: "Gulu", reason: "r" },
  ],
  extras: { planSetup: { "code:1.1": setup }, team: [{ key: "ali", name: "Ali Hassan" }] },
} as never;

test("each planned activity is joined to its links; one with none yet has an empty set", () => {
  const rows = planRows(view);
  assert.deepEqual(rows[0]!.setup, setup);
  assert.deepEqual(rows[1]!.setup, { placeNames: [], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false });
});

test("only activities with a code, places with a name and indicators with a code are offered", () => {
  assert.deepEqual(activityOptions(view).map((a) => a.code), ["A1"]);
  assert.deepEqual(placeNames(view), ["Gulu"]);
  assert.deepEqual(indicatorOptions(view).map((i) => i.code), ["I1"]);
});

test("choosing a place ends project-wide, and project-wide clears the named places", () => {
  assert.deepEqual(placePatch(setup, "Kitgum", true), { placeNames: ["Gulu", "Kitgum"], projectWide: false });
  assert.deepEqual(placePatch(setup, "Gulu", false), { placeNames: [] });
  assert.deepEqual(projectWidePatch(true), { projectWide: true, placeNames: [] });
  assert.deepEqual(projectWidePatch(false), { projectWide: false });
});

test("indicators are added once and removed cleanly", () => {
  assert.deepEqual(indicatorPatch(setup, "I1", true), { indicatorCodes: ["I1"] });
  assert.deepEqual(indicatorPatch(setup, "I2", true), { indicatorCodes: ["I1", "I2"] });
  assert.deepEqual(indicatorPatch(setup, "I1", false), { indicatorCodes: [] });
});

test("files typed with commas become a clean list", () => {
  assert.deepEqual(parseFiles(" Attendance sheet, Photos ,, Photos"), ["Attendance sheet", "Photos"]);
  assert.deepEqual(parseFiles("  "), []);
});

test("a share is never outside 0 to 1, and nothing to do counts as complete", () => {
  assert.equal(share(0, 0), 1);
  assert.equal(share(3, 4), 0.75);
  assert.equal(share(9, 4), 1);
  assert.equal(share(-1, 4), 0);
});

test("suggestions group by row and name their target in words", () => {
  const by = suggestionsByRow(view);
  assert.deepEqual([...by.keys()], ["code:1.1", "new:2"]);
  assert.equal(by.get("code:1.1")!.length, 2);
  const [indicator, lead, place] = view.suggestions;
  assert.equal(suggestionTarget(view, indicator), "I1 · Working wells");
  assert.equal(suggestionTarget(view, lead), "Ali Hassan");
  assert.equal(suggestionTarget(view, place), "Gulu");
});

test("the words on this slide are plain language", () => {
  const c = PCW_COPY.plan;
  const texts = [...Object.values(c).filter((v): v is string => typeof v === "string"), c.activitiesLine(1, 2), c.plansLine(1, 2), c.indicatorsLine(1, 2), c.acceptSelected(2), c.acceptAll(3)];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});
