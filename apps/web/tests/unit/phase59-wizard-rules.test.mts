import test from "node:test";
import assert from "node:assert/strict";
import { indicatorSummary, planSummary } from "../../src/features/project-setup/pcw/domain/row-summary.ts";
import { APPLY_ALL_FIELDS, applyAllTargets } from "../../src/features/project-setup/pcw/domain/apply-all.ts";
import { carriedFacts } from "../../src/features/project-setup/pcw/domain/carried-facts.ts";
import { foundSummary, offersFound } from "../../src/features/project-setup/pcw/domain/found-summary.ts";
import { isSmallTeam, reviewDefaultFor, SMALL_TEAM_BELOW } from "../../src/features/project-setup/pcw/domain/review-default.ts";
import type { SetupDraftView } from "../../src/lib/server/schemas-project-setup-draft.ts";

const item = (path: string, value: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ path, value, status: "ACCEPTED", origin: "USER", ...extra });
const person = (key: string, name: string, role = "PROJECT_MANAGER") => ({ key, name, role, external: false, invite: "LATER" });
const view = (over: Record<string, unknown> = {}): SetupDraftView => ({
  status: "READY", sources: [], progress: [], facts: { startDate: null, endDate: null, currency: null },
  indicators: [], plan: [], places: [], logframe: [], funding: [], budget: [], risks: [],
  extras: { start: {}, team: [], indicatorSetup: {}, planSetup: {}, collection: {} },
  ...over,
}) as unknown as SetupDraftView;

const indicatorRow = (value: Record<string, unknown>, ownerKey = "", direction = "", baselineNone = false) => ({ item: item("i", value), value, ownerKey, direction, baselineNone }) as never;

test("an indicator row says what it still needs, and a finished one needs nothing", () => {
  const bare = indicatorSummary(indicatorRow({ code: "I1", title: "x" }));
  assert.deepEqual(bare.gaps, ["result", "type", "baseline", "target", "frequency", "owner", "direction"]);
  assert.deepEqual(bare.facts, []);
  const done = indicatorSummary(indicatorRow({ code: "I1", logframeCode: "O1", type: "NUMBER", baseline: "0", target: "100", unit: "people", frequency: "Monthly" }, "k1", "HIGHER"));
  assert.deepEqual(done.gaps, []);
  assert.deepEqual(done.facts, ["NUMBER", "→ 100 people", "Monthly"]);
});

test("'no baseline' is an answer, so it is not a gap", () => {
  assert.ok(!indicatorSummary(indicatorRow({ code: "I1", logframeCode: "O1", type: "NUMBER", target: "1", frequency: "Monthly" }, "k", "HIGHER", true)).gaps.includes("baseline"));
});

test("a plan row needs dates, a place or project-wide, and a lead", () => {
  const setup = { placeNames: [], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false };
  const row = (value: Record<string, unknown>, s: Record<string, unknown> = {}) => ({ item: item("p", value), setup: { ...setup, ...s } }) as never;
  assert.deepEqual(planSummary(row({ title: "t" })).gaps, ["activity", "dates", "place", "lead"]);
  const full = planSummary(row({ title: "t", logframeCode: "A1", start: "2026-01-01", end: "2026-02-01" }, { projectWide: true, leadKey: "k" }));
  assert.deepEqual(full.gaps, []);
  assert.deepEqual(full.facts, ["2026-01-01 → 2026-02-01"]);
  assert.deepEqual(planSummary(row({ title: "t", start: "2026-01-01" }, { placeNames: ["Gulu"] })).gaps, ["activity", "dates", "lead"]);
});

test("apply to all targets only the rows with no value and never a rejected one", () => {
  const v = view({
    indicators: [item("a", { code: "I1" }), item("b", { code: "I2" }), item("c", { code: "I3" }, { status: "REJECTED" })],
    plan: [item("p1", {}, { planKey: "P1" }), item("p2", {}, { planKey: "P2" })],
    extras: { start: {}, team: [], indicatorSetup: { I1: { ownerKey: "k", direction: "LOWER" } }, planSetup: { P1: { leadKey: "k" } }, collection: {} },
  });
  assert.deepEqual(applyAllTargets(v, "owner"), ["I2"]);
  assert.deepEqual(applyAllTargets(v, "direction"), ["I2"]);
  assert.deepEqual(applyAllTargets(v, "lead"), ["P2"]);
  assert.deepEqual(APPLY_ALL_FIELDS.direction.edit("I2", "HIGHER"), { kind: "SET_INDICATOR_SETUP", code: "I2", patch: { direction: "HIGHER", directionConfirmed: true } });
  assert.deepEqual(APPLY_ALL_FIELDS.lead.edit("P2", "k"), { kind: "SET_PLAN_SETUP", planKey: "P2", patch: { leadKey: "k" } });
});

test("a fact the person gave is carried to the slide that uses it, with where it came from, and nothing is invented", () => {
  const v = view({
    facts: { startDate: "2026-01-01", endDate: "2026-12-31", currency: "USD" },
    places: [item("pl", { name: "Gulu" }), item("pl2", { name: "Lira" }, { status: "REJECTED" })],
    extras: { start: { country: "Uganda" }, team: [person("k1", "Ann"), person("k2", "Ben", "ME_OFFICER")], indicatorSetup: {}, planSetup: {}, collection: {} },
  });
  assert.deepEqual(carriedFacts(v, "PLACES"), [{ key: "country", from: "START", value: "Uganda" }]);
  const plan = carriedFacts(v, "WORK_PLAN");
  assert.deepEqual(plan.map((f) => f.key), ["team", "places", "dates"]);
  assert.equal(plan.find((f) => f.key === "places")?.value, "Gulu", "a removed place is not carried");
  assert.equal(carriedFacts(v, "FINANCE")[0]?.value, "USD");
  assert.deepEqual(carriedFacts(view(), "PLACES"), [], "nothing given, nothing shown");
  assert.deepEqual(carriedFacts(view(), "WORK_PLAN"), []);
});

test("what we found counts only items that came from a document, and confirming covers only those that wait", () => {
  const v = view({
    sources: [{}],
    progress: [{ slide: "START", complete: true }, { slide: "RESULTS", complete: false }, { slide: "INDICATORS", complete: false }],
    logframe: [item("l1", {}, { origin: "DOCUMENT", status: "PROPOSED" }), item("l2", {}, { origin: "DOCUMENT", status: "ACCEPTED" }), item("l3", {}, { origin: "USER", status: "PROPOSED" })],
    indicators: [item("i1", {}, { origin: "DOCUMENT", status: "REJECTED" })],
  });
  const s = foundSummary(v);
  assert.deepEqual(s.areas.map((a) => [a.key, a.found, a.waiting]), [["LOGFRAME", 2, 1]]);
  assert.deepEqual(s.areas[0]!.waitingPaths, ["l1"]);
  assert.equal(s.firstToReview, "RESULTS");
  assert.equal(offersFound(v, s), true);
  assert.equal(offersFound(view({ ...v, sources: [] }), s), false, "no documents, no card");
  assert.equal(offersFound(view({ ...v, status: "EXTRACTING" }), s), false, "not while still reading");
  assert.equal(offersFound(view({ sources: [{}] }), foundSummary(view({ sources: [{}] }))), false, "nothing found, no card");
});

test("a small team starts with simple review, once, and a choice is never replaced", () => {
  const team = (n: number) => Array.from({ length: n }, (_, i) => person(`k${i}`, `P${i}`));
  const v = (n: number, mode?: string) => view({ extras: { start: {}, team: team(n), indicatorSetup: {}, planSetup: {}, collection: mode ? { reviewMode: mode } : {} } });
  assert.equal(SMALL_TEAM_BELOW, 3);
  assert.equal(reviewDefaultFor(v(1)), "SIMPLE");
  assert.equal(reviewDefaultFor(v(2)), "SIMPLE");
  assert.equal(reviewDefaultFor(v(3)), null);
  assert.equal(reviewDefaultFor(v(0)), null, "no team yet, no default");
  assert.equal(reviewDefaultFor(v(2, "FULL")), null, "the person's choice stands");
  assert.equal(reviewDefaultFor(v(2, "SIMPLE")), null);
  assert.equal(isSmallTeam(2), true);
  assert.equal(isSmallTeam(3), false);
});
