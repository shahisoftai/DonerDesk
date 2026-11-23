import assert from "node:assert/strict";
import test from "node:test";
import { Permissions } from "@donordesk/domain";

const { RULES } = await import("../dist/middleware/authorization.js");

/** The rule that answers a request, as the middleware reads it (first match wins per method + path). */
const ruleFor = (method, path) => RULES.find((r) => r.method === method && r.route.test(path));
const reaches = (role, method, path) => {
  const r = ruleFor(method, path);
  return r ? Permissions.can(role, r.permission) : false;
};

const P = "/v1/projects/p1";
/** What a field officer must never read or change (Phase 63): money, billing, analysis across everyone's records, plan changes. */
const CLOSED = [
  ["GET", "/v1/finance/funding-sources"], ["GET", "/v1/finance/budget-categories"], ["GET", "/v1/finance/rates"], ["GET", `${P}/finance`], ["GET", "/v1/portfolio/finance"],
  ["GET", "/v1/funding"], ["GET", `${P}/budget`], ["GET", "/v1/reporting-periods/r1/finance"], ["GET", "/v1/billing/summary"],
  ["POST", `${P}/finance/import`], ["POST", "/v1/finance/parse-file"],
  ["GET", `${P}/logframe/versions`], ["GET", `${P}/logframe/versions/v1/changes`], ["GET", `${P}/data-sheet`], ["GET", `${P}/data-sheet/export`],
  ["GET", `${P}/management-report`], ["GET", `${P}/closing-report/plan`], ["GET", "/v1/portfolio/overview"], ["GET", "/v1/portfolio/health"], ["GET", "/v1/portfolio/indicators"],
  ["GET", `${P}/adaptations`], ["POST", `${P}/adaptations`], ["PUT", "/v1/adaptations/a1"],
];

test("a field officer cannot reach money, billing, analysis or plan changes", () => {
  const open = CLOSED.filter(([m, p]) => reaches("FIELD_OFFICER", m, p)).map(([m, p]) => `${m} ${p}`);
  assert.deepEqual(open, []);
});

test("nothing is lost for the other roles that could reach those routes before", () => {
  for (const role of ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"]) {
    for (const [m, p] of CLOSED.filter(([m]) => m === "GET")) assert.ok(reaches(role, m, p), `${role} ${m} ${p}`);
  }
  for (const role of ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "COMPLIANCE_OFFICER"]) {
    assert.ok(reaches(role, "POST", `${P}/finance/import`), `${role} finance import`);
    assert.ok(reaches(role, "POST", `${P}/adaptations`), `${role} adaptations`);
  }
});

/**
 * Every write a field officer can reach is either field work (held through a field permission) or a personal workspace route under
 * `project.view`. A new write rule that reaches a field officer fails here until it is listed on purpose.
 */
const FIELD_PERMISSIONS = new Set(["workplan.update-own", "activity.create", "collection.submit", "evidence.upload", "risk.raise", "dataset.contribute", "comment.create"]);
const PERSONAL_WORKSPACE = [
  /^\/v1\/(bookmarks|home-pins|home-layout|me\/|notifications\/|legal\/consent)/,
  /^\/v1\/(saved-reports|charts|dashboards|dashboard-preview|dashboard-links|dashboard-templates|canvases|visual-data|datasets\/resolve|datasets\/\[\^\/\]\+\/kit-dashboards|infographics)/,
  /^\/v1\/(tasks|evidence\/search|places\/resolve|projects\/\[\^\/\]\+\/(ask|places\/inline|analysis|record-places))/,
];

test("every write a field officer can reach is field work or personal workspace", () => {
  const unlisted = [];
  for (const r of RULES) {
    if (r.method === "GET" || r.method === "HEAD") continue;
    if (!Permissions.can("FIELD_OFFICER", r.permission)) continue;
    if (FIELD_PERMISSIONS.has(r.permission)) continue;
    const src = r.route.source.replace(/\\\//g, "/").replace(/^\^/, "");
    if (r.permission === "project.view" && PERSONAL_WORKSPACE.some((re) => re.test(src))) continue;
    unlisted.push(`${r.method} ${src} (${r.permission})`);
  }
  assert.deepEqual(unlisted, []);
});
