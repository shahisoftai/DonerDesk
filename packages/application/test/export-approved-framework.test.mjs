import assert from "node:assert/strict";
import test from "node:test";
import { indicatorAsApproved, versionInForce, buildLogframeSnapshot, canonicalSnapshotJson } from "@donordesk/domain";

const item = { id: "i1", level: "OUTPUT", code: "OUT-1", title: "T", sortOrder: 0 };
const ind = (target) => ({ id: "n1", logframeItemId: "i1", code: "IND-1", name: "N", type: "NUMBER", baseline: "0", target, disaggregationRequired: false, isArchived: false, targetBreakdowns: [] });
const version = (target, iso) => ({ snapshotJson: canonicalSnapshotJson(buildLogframeSnapshot([item], [ind(target)])), createdAt: new Date(iso) });

test("52.3: the framework in force at approval is the newest version created at or before it", () => {
  const versions = [version("150", "2026-03-01T00:00:00Z"), version("120", "2026-02-01T00:00:00Z"), version("100", "2026-01-01T00:00:00Z")];
  assert.equal(versionInForce(versions, new Date("2026-02-15T00:00:00Z")).indicators[0].target, "120");
  assert.equal(versionInForce(versions, new Date("2026-03-01T00:00:00Z")).indicators[0].target, "150");
  assert.equal(versionInForce(versions, new Date("2025-12-31T00:00:00Z")), null, "nothing existed yet");
  assert.equal(versionInForce([], new Date()), null);
});

test("52.3: an approved report's indicator keeps the target it was approved against; one the snapshot never knew is unchanged", () => {
  const approved = versionInForce([version("120", "2026-02-01T00:00:00Z")], new Date("2026-02-15T00:00:00Z"));
  const live = { id: "n1", code: "IND-1", baseline: "0", target: "200" };
  assert.equal(indicatorAsApproved(live, approved).target, "120");
  assert.equal(indicatorAsApproved(live, approved).code, "IND-1");
  const added = { id: "new", code: "IND-9", baseline: "1", target: "5" };
  assert.deepEqual(indicatorAsApproved(added, approved), added);
  assert.deepEqual(indicatorAsApproved(live, null), live);
});
