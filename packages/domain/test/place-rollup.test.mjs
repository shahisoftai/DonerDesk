import test from "node:test";
import assert from "node:assert/strict";
import { PlaceRegistry, indicatorLocationRows, rollupByPlace } from "../dist/index.js";

const P = (id, name, adminLevel, parentId, over = {}) => ({ id, name, kind: "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false, ...over });
const reg = new PlaceRegistry([
  P("sd", "Sudan", 0), P("wn", "White Nile", 1, "sd"), P("kas", "Kassala", 1, "sd"),
  P("rabak", "Rabak", 2, "wn", { aliases: ["Rabak locality"] }), P("kosti", "Kosti", 2, "wn"), P("sinja", "Sinja", 2, "kas"),
]);
const num = { id: "i", code: "OC1", name: "Children", type: "NUMBER" };
const rate = { id: "r", code: "OC2", name: "Coverage", type: "PERCENTAGE" };
const upd = (period, entries, verified = true) => ({ reportingPeriodId: period, periodAchievement: "0", cumulativeAchievement: "0", verificationStatus: verified ? "VERIFIED" : "DRAFT", disaggregation: entries.map(([category, value]) => ({ dimension: "LOCATION", category, value })) });

test("additive values sum up the tree; locations spelled differently merge into one place", () => {
  const view = indicatorLocationRows(num, [upd("p1", [["Rabak", "70"], ["Sinja", "55"]]), upd("p2", [["Rabak locality", "30"], ["Kosti", "10"]])]);
  const r = rollupByPlace(view, reg, 1);
  assert.equal(r.additive, true);
  const wn = r.rows.find((x) => x.name === "White Nile");
  const kas = r.rows.find((x) => x.name === "Kassala");
  assert.equal(wn.value, "110");
  assert.equal(wn.contributors, 2);
  assert.equal(kas.value, "55");
  assert.deepEqual(r.unplaced, []);
  assert.equal(rollupByPlace(view, reg, 0).rows[0].value, "165");
  assert.equal(rollupByPlace(view, reg, 0).rows[0].path, "Sudan");
});

test("a place at its own level keeps its value; deeper totals are partly reported when a listed place recorded nothing", () => {
  const view = indicatorLocationRows(num, [upd("p1", [["Rabak", "70"]])]);
  const r = rollupByPlace(view, reg, 1);
  const wn = r.rows[0];
  assert.equal(wn.value, "70");
  assert.equal(wn.listedBelow, 2);
  assert.equal(wn.partly, true);
  const own = rollupByPlace(view, reg, 2).rows[0];
  assert.equal(own.partly, false);
});

test("a rate is never combined: one reporting place shows its value, two show none", () => {
  const one = rollupByPlace(indicatorLocationRows(rate, [upd("p1", [["Rabak", "80"]])]), reg, 1);
  assert.equal(one.additive, false);
  assert.equal(one.rows[0].value, "80");
  const two = rollupByPlace(indicatorLocationRows(rate, [upd("p1", [["Rabak", "80"], ["Kosti", "60"]])]), reg, 1);
  assert.equal(two.rows[0].value, null);
  assert.equal(two.rows[0].contributors, 2);
});

test("words that match no place, two places, or sit above the level are listed apart, never dropped or spread", () => {
  const dup = new PlaceRegistry([...reg.all(), P("rabak2", "Rabak", 2, "kas")]);
  const view = indicatorLocationRows(num, [upd("p1", [["Atlantis", "5"], ["Rabak", "7"], ["Sudan", "9"], ["Sinja", "1"]])]);
  const r = rollupByPlace(view, dup, 2);
  const why = Object.fromEntries(r.unplaced.map((u) => [u.location, u.reason]));
  assert.deepEqual(why, { Atlantis: "NOT_IN_LIST", Rabak: "MORE_THAN_ONE_PLACE", Sudan: "ABOVE_LEVEL" });
  assert.equal(r.unplaced.find((u) => u.location === "Rabak").candidates.length, 2);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].name, "Sinja");
});

test("unverified values are counted, and the total says so; a project-wide indicator has no place view", () => {
  const view = indicatorLocationRows(num, [upd("p1", [["Rabak", "70"]], false), upd("p2", [["Kosti", "5"]], true)]);
  const wn = rollupByPlace(view, reg, 1).rows[0];
  assert.equal(wn.verified, false);
  assert.equal(wn.unverified, 1);
  assert.equal(rollupByPlace(indicatorLocationRows(num, [upd("p1", [])]), reg, 1), null);
});
