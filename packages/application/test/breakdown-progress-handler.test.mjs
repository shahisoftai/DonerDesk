import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetBreakdownProgressHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const OUTSIDER = ctxFor("me", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });
const e = (category, value) => ({ dimension: "SEX", category, value });

const indicator = (id, code, targetBreakdowns) => ({ id, code, name: `Indicator ${code}`, unit: "people", type: "NUMBER", targetBreakdowns });
const update = (periodId, status, entries) => ({ reportingPeriodId: periodId, verificationStatus: status, disaggregation: entries });

function handler(indicators, updatesByIndicator) {
  return new GetBreakdownProgressHandler(
    { findByProject: async () => ok(indicators) },
    { findByIndicator: async (id) => ok(updatesByIndicator[id] ?? []) },
    { findByProject: async () => ok([{ id: "p1", duration: { end: new Date("2026-03-31") } }, { id: "p2", duration: { end: new Date("2026-06-30") } }]) },
    { activeMemberIds: async () => ok(new Set(["pm"])) },
  );
}

test("each indicator with group targets shows the target beside the verified figure; drafts do not count", async () => {
  const h = handler(
    [indicator("i1", "1.2", [e("Women", "150")]), indicator("i2", "1.1", [e("Women", "100")]), indicator("i3", "1.3", [])],
    { i1: [update("p1", "VERIFIED", [e("Women", "40")]), update("p2", "DRAFT", [e("Women", "999")])], i2: [update("p1", "VERIFIED", [e("Women", "10")]), update("p2", "VERIFIED", [e("Women", "15")])] },
  );
  const res = await h.handle(PM, "p");
  assert.deepEqual(res.value.map((i) => i.code), ["1.1", "1.2"], "sorted by code; an indicator without group targets is left out");
  assert.deepEqual(res.value[0].rows[0], { dimension: "SEX", category: "Women", target: 100, actual: 25, percentOfTarget: 25, periods: 2 });
  assert.deepEqual([res.value[1].rows[0].actual, res.value[1].rows[0].periods], [40, 1], "the draft is not counted");
});

test("only people on the project see it; a project with no group targets has nothing to show", async () => {
  const h = handler([indicator("i1", "1.1", [e("Women", "10")])], {});
  assert.equal((await h.handle(OUTSIDER, "p")).ok, false);
  const empty = handler([indicator("i1", "1.1", [])], {});
  assert.deepEqual((await empty.handle(PM, "p")).value, []);
  assert.equal((await h.handle(PM, "p")).value[0].rows[0].actual, null, "no verified value: blank, not zero");
});
