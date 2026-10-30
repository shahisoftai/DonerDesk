import test from "node:test";
import assert from "node:assert/strict";
import { projectListTable, validateProjectList, widgetProblems, PROJECT_LIST_MAX_ROWS } from "../dist/index.js";

const p = (projectId, o = {}) => ({ projectId, title: `Project ${projectId}`, status: "ACTIVE", sector: "WASH", country: "Ethiopia", donorName: "UNICEF", ...o });

test("a list is filtered by status and sector, in title order, and 'assigned' shows only the viewer's own", () => {
  const src = [p("c"), p("a", { status: "DRAFT" }), p("b", { sector: "HEALTH", managerId: "me" }), p("d", { meOfficerId: "me" })];
  assert.deepEqual(projectListTable(src, { affiliation: "ALL" }, "me").rows.map((r) => r[0]), ["Project a", "Project b", "Project c", "Project d"]);
  assert.deepEqual(projectListTable(src, { affiliation: "ALL", status: "active" }, "me").rows.map((r) => r[0]), ["Project b", "Project c", "Project d"]);
  assert.deepEqual(projectListTable(src, { affiliation: "ALL", sector: "health" }, "me").rows.map((r) => r[0]), ["Project b"]);
  assert.deepEqual(projectListTable(src, { affiliation: "ASSIGNED" }, "me").rows.map((r) => r[0]), ["Project b", "Project d"]);
  assert.deepEqual(projectListTable(src, { affiliation: "ASSIGNED" }, "someone-else").rows, []);
});

test("an empty list says so, a long one is capped and says so, a missing value is 'Not recorded'", () => {
  assert.match(projectListTable([], { affiliation: "ALL" }, "me").notes[0], /No project matches/);
  const many = Array.from({ length: PROJECT_LIST_MAX_ROWS + 3 }, (_, i) => p(String(i).padStart(3, "0")));
  const t = projectListTable(many, { affiliation: "ALL", title: "Mine" }, "me");
  assert.equal(t.rows.length, PROJECT_LIST_MAX_ROWS);
  assert.equal(t.title, "Mine");
  assert.match(t.notes[0], /first 50 of 53/);
  assert.deepEqual(projectListTable([p("x", { sector: "", country: "", donorName: "" })], { affiliation: "ALL" }, "me").rows[0].slice(2), ["Not recorded", "Not recorded", "Not recorded"]);
});

test("a list widget needs valid filters and is checked with the others", () => {
  assert.equal(validateProjectList({ affiliation: "ALL" }), null);
  assert.match(validateProjectList({ affiliation: "NOPE" }), /Choose which/);
  const w = (extra) => ({ id: "l1", projectId: "p1", kind: "PROJECT_LIST", x: 0, y: 0, w: 12, h: 5, ...extra });
  assert.deepEqual(widgetProblems([w({ projectList: { affiliation: "ASSIGNED" } })]), []);
  assert.match(widgetProblems([w({})])[0].message, /needs its filters/);
});
