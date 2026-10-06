import test from "node:test";
import assert from "node:assert/strict";
import { pickDefaultTemplate } from "../dist/index.js";

const t = (id, reportType, status = "REVIEWED", day = 1) => ({ id, reportType, status, updatedAt: new Date(Date.UTC(2026, 0, day)) });

test("a reviewed template of the exact type wins over a profile default of another type", () => {
  const r = pickDefaultTemplate({ reportType: "FINAL", profileDefaultId: "m", candidates: [t("m", "MONTHLY"), t("f", "FINAL")] });
  assert.deepEqual(r, { templateId: "f", source: "TYPE_MATCH" });
});

test("the profile default wins among several exact reviewed templates, otherwise the newest", () => {
  const candidates = [t("a", "FINAL", "REVIEWED", 1), t("b", "FINAL", "REVIEWED", 5), t("c", "FINAL", "REVIEWED", 3)];
  assert.equal(pickDefaultTemplate({ reportType: "FINAL", profileDefaultId: "c", candidates }).templateId, "c");
  assert.equal(pickDefaultTemplate({ reportType: "FINAL", candidates }).templateId, "b");
});

test("an unreviewed template of the exact type is not picked by type", () => {
  const r = pickDefaultTemplate({ reportType: "FINAL", candidates: [t("f", "FINAL", "NEEDS_REVIEW")] });
  assert.deepEqual(r, { source: "NONE" });
});

test("with no exact match the profile default applies as before, when its type may structure the report", () => {
  assert.deepEqual(pickDefaultTemplate({ reportType: "QUARTERLY", profileDefaultId: "m", candidates: [t("m", "MONTHLY")] }), { templateId: "m", source: "PROFILE_DEFAULT" });
  // an unreviewed default is still the default (generation itself requires review, as before)
  assert.equal(pickDefaultTemplate({ reportType: "QUARTERLY", profileDefaultId: "m", candidates: [t("m", "MONTHLY", "NEEDS_REVIEW")] }).templateId, "m");
});

test("activity and situation reports only accept a template of their own type", () => {
  assert.deepEqual(pickDefaultTemplate({ reportType: "ACTIVITY", profileDefaultId: "m", candidates: [t("m", "MONTHLY")] }), { source: "NONE" });
  assert.equal(pickDefaultTemplate({ reportType: "ACTIVITY", candidates: [t("a", "ACTIVITY")] }).templateId, "a");
});

test("nothing to pick, a deleted default and no candidates give none", () => {
  assert.deepEqual(pickDefaultTemplate({ reportType: "MONTHLY", candidates: [] }), { source: "NONE" });
  assert.deepEqual(pickDefaultTemplate({ reportType: "MONTHLY", profileDefaultId: "gone", candidates: [] }), { source: "NONE" });
});
