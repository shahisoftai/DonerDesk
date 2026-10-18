import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRisk, reviewByFor, canActOnRisk, RISK_KIND_LABEL, SERIOUSNESS_LABEL, REVIEW_EVERY_DAYS, Permissions, ALL_ROLES, findRawTokens, ASSIGNMENT_KINDS } from "../dist/index.js";

const TODAY = "2026-03-10";
const make = (extra = {}) => ProjectRisk.create({ id: "r1", tenantId: "tenant-a", projectId: "p", kind: "PROBLEM", title: "Road washed out", seriousness: "HIGH", action: "Rerouting trucks", raisedById: "u1", today: TODAY, ...extra });

test("the four fields a person fills in, in plain words, and nothing else is required", () => {
  const r = make({ ownerId: "u2" });
  assert.equal(r.ok, true);
  const s = r.value.snapshot();
  assert.deepEqual([s.kind, s.title, s.seriousness, s.ownerId, s.action, s.status], ["PROBLEM", "Road washed out", "HIGH", "u2", "Rerouting trucks", "OPEN"]);
  assert.equal(make({ action: "" }).ok, true, "what we are doing can be filled in later");
  assert.equal(make({ title: "  " }).error.details.field, "title");
  assert.equal(make({ title: "x".repeat(201) }).ok, false);
  assert.equal(make({ kind: "SOMETHING" }).error.details.field, "kind");
  assert.equal(make({ seriousness: "EXTREME" }).error.details.field, "seriousness");
  assert.equal(make({ action: "x".repeat(1001) }).error.details.field, "action");
});

test("words: 'It has happened' and 'It might happen', High / Medium / Low; no codes", () => {
  assert.deepEqual(Object.values(RISK_KIND_LABEL), ["It has happened", "It might happen"]);
  assert.deepEqual(Object.values(SERIOUSNESS_LABEL), ["High", "Medium", "Low"]);
  for (const t of [...Object.values(RISK_KIND_LABEL), ...Object.values(SERIOUSNESS_LABEL), ASSIGNMENT_KINDS.RISK_REVIEW.label]) assert.deepEqual(findRawTokens(t), []);
});

test("a serious problem is looked at again in 30 days; the others are not scheduled", () => {
  assert.equal(REVIEW_EVERY_DAYS, 30);
  assert.equal(reviewByFor("HIGH", TODAY), "2026-04-09");
  assert.equal(reviewByFor("MEDIUM", TODAY), undefined);
  assert.equal(make().value.reviewBy, "2026-04-09");
  assert.equal(make({ seriousness: "LOW" }).value.reviewBy, undefined);
});

test("changing what is being done counts as looking at it again; seriousness moves the review in and out", () => {
  const r = make({ ownerId: "u2" }).value;
  const out = r.update({ action: "Boats instead" }, "2026-03-25");
  assert.deepEqual(out.value.changed, ["action"]);
  assert.equal(r.reviewBy, "2026-04-24", "pushed 30 days from the day it was updated");
  assert.deepEqual(r.update({ action: "Boats instead" }, "2026-03-26").value.changed, [], "no change, no new review date");
  assert.equal(r.reviewBy, "2026-04-24");
  r.update({ seriousness: "LOW" }, "2026-03-26");
  assert.equal(r.reviewBy, undefined, "no longer serious: nothing to review");
  r.update({ seriousness: "HIGH" }, "2026-03-27");
  assert.equal(r.reviewBy, "2026-04-26");
  r.update({ ownerId: undefined }, "2026-03-27");
  assert.equal(r.ownerId, undefined, "nobody handling it is allowed");
  assert.equal(r.update({ title: "" }, TODAY).ok, false);
  assert.equal(r.title, "Road washed out", "a refused change is not kept");
});

test("closing keeps the note, ends the review, and a closed problem cannot change or close again", () => {
  const r = make().value;
  assert.equal(r.close("u2", "  Road repaired ", new Date("2026-03-20T10:00:00Z")).ok, true);
  const s = r.snapshot();
  assert.deepEqual([s.status, s.closedNote, s.closedById, s.reviewBy], ["CLOSED", "Road repaired", "u2", undefined]);
  assert.equal(r.close("u2", "again", new Date()).ok, false);
  assert.equal(r.update({ action: "x" }, TODAY).ok, false);
});

test("who may raise, manage and close", () => {
  const can = (p) => ALL_ROLES.filter((r) => Permissions.can(r, p)).sort();
  assert.deepEqual(can("risk.raise"), ["ADMIN", "COMPLIANCE_OFFICER", "FIELD_OFFICER", "GRANTS_OFFICER", "ME_OFFICER", "PROJECT_MANAGER"], "anyone but a viewer");
  assert.deepEqual(can("risk.manage"), ["ADMIN", "COMPLIANCE_OFFICER", "GRANTS_OFFICER", "ME_OFFICER", "PROJECT_MANAGER"]);
  assert.equal(canActOnRisk("u2", { ownerId: "u2", raisedById: "u1" }, false), true, "the person handling it");
  assert.equal(canActOnRisk("u1", { ownerId: "u2", raisedById: "u1" }, false), true, "the one who raised it");
  assert.equal(canActOnRisk("u9", { ownerId: "u2", raisedById: "u1" }, false), false);
  assert.equal(canActOnRisk("u9", { ownerId: "u2", raisedById: "u1" }, true), true, "a manager");
});
