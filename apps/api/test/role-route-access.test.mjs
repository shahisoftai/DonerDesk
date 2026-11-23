import assert from "node:assert/strict";
import test from "node:test";

const { isRouteAllowedForRole, isRestrictedToRoutes, ROLE_ROUTE_ALLOWLISTS, roleRouteAccessMiddleware } = await import("../dist/middleware/role-route-access.js");

const P = "/v1/projects/p1";
const FO = "FIELD_OFFICER";

/** What a field officer's own screens call: every one must stay open. */
const OPEN = [
  ["GET", "/v1/organization"], ["GET", "/v1/dashboard"], ["GET", "/v1/me/week"], ["GET", "/v1/me/assignments"], ["GET", "/v1/me/facility-assignments"], ["GET", "/v1/me/collection-drafts"],
  ["GET", "/v1/notifications"], ["POST", "/v1/notifications/n1/read"], ["GET", "/v1/legal/consent"], ["POST", "/v1/legal/consent"],
  ["GET", "/v1/projects"], ["GET", P], ["GET", `${P}/logframe`], ["GET", `${P}/reporting-periods`], ["GET", `${P}/reporting-profile`], ["GET", `${P}/people`],
  ["GET", `${P}/work-plan`], ["GET", `${P}/activities`], ["GET", `${P}/risks`], ["POST", `${P}/risks`], ["PUT", "/v1/work-plan/w1/status"], ["PUT", "/v1/work-plan/w1"], ["POST", "/v1/work-plan/w1/progress"], ["POST", "/v1/work-plan/w1/complete"],
  ["POST", "/v1/activities"], ["PATCH", "/v1/activities/a1"], ["GET", "/v1/activities/a1"], ["POST", "/v1/activities/attach-evidence"], ["POST", "/v1/activities/a1/resubmit"],
  ["POST", "/v1/evidence/upload"], ["POST", "/v1/evidence/e1/accept-tags"], ["GET", "/v1/evidence/e1"], ["GET", "/v1/files/key1"],
  ["GET", `${P}/collection-forms`], ["GET", "/v1/collection-forms/f1"], ["POST", "/v1/collection-forms/f1/records"], ["POST", "/v1/collection-forms/f1/files"],
  ["GET", "/v1/collection-forms/f1/draft"], ["PUT", "/v1/collection-forms/f1/draft"], ["DELETE", "/v1/collection-forms/f1/draft"], ["GET", "/v1/collection-forms/f1/prefill"],
  ["POST", "/v1/collection-assignments/c1/move"], ["GET", `${P}/offline-pack`], ["GET", `${P}/offline-basemap`], ["GET", `${P}/places`], ["GET", `${P}/entry-places`], ["GET", "/v1/places"],
  ["GET", `${P}/beneficiaries`], ["POST", `${P}/beneficiaries`], ["PUT", "/v1/beneficiaries/b1"], ["DELETE", "/v1/beneficiaries/b1"], ["POST", "/v1/comments"], ["GET", "/v1/comments"],
  ["HEAD", `${P}/work-plan`],
];

/** What a field officer must never call (money, analysis, the library of everyone's evidence, building visuals, managing anything). */
const CLOSED = [
  ["GET", `${P}/finance`], ["GET", `${P}/budget`], ["GET", "/v1/funding"], ["GET", "/v1/billing/summary"], ["GET", "/v1/finance/rates"], ["POST", `${P}/finance/import`], ["POST", `${P}/finance/budget-lines/b1/expenses`], ["PUT", `${P}/finance/expenses/x1`],
  ["GET", `${P}/data-sheet`], ["GET", `${P}/data-sheet/export`], ["GET", `${P}/management-report`], ["GET", `${P}/framework`], ["GET", `${P}/logframe/versions`], ["GET", "/v1/portfolio/overview"], ["GET", `${P}/place-results`], ["GET", `${P}/adaptations`],
  ["POST", "/v1/evidence/search"], ["POST", "/v1/evidence/import"], ["POST", "/v1/evidence/parse-file"], ["POST", "/v1/evidence/e1/period"],
  ["POST", `${P}/ask`], ["POST", "/v1/visual-data/query"], ["POST", "/v1/datasets/resolve"], ["GET", "/v1/datasets"], ["POST", "/v1/datasets/uploads"],
  ["GET", "/v1/canvases"], ["POST", "/v1/canvases"], ["GET", "/v1/dashboards"], ["POST", "/v1/dashboards"], ["GET", "/v1/charts"], ["GET", "/v1/saved-reports"], ["POST", "/v1/dashboard-preview"],
  ["GET", "/v1/work-plan/w1/budget"], ["POST", "/v1/work-plan/w1/budget-lines"], ["POST", "/v1/work-plan/w1/budget-lines/l1/expenses"],
  ["GET", "/v1/collection-forms/f1/assignments"], ["GET", "/v1/collection-forms/f1/totals"], ["GET", "/v1/collection-forms/f1/template"], ["GET", "/v1/form-kits"],
  ["POST", "/v1/activities/import"], ["POST", "/v1/activities/parse-file"], ["POST", `${P}/beneficiaries/import`],
  ["GET", "/v1/where-we-work"], ["GET", "/v1/places/export"], ["GET", "/v1/places/p1/profile"], ["GET", "/v1/places/p1/geometry"], ["POST", `${P}/places/inline`], ["POST", `${P}/analysis/population`], ["GET", "/v1/sector-library"], ["GET", "/v1/home-layout"],
  ["GET", `${P}/members`], ["GET", `${P}/setup`], ["GET", `${P}/team-work`], ["POST", "/v1/users/invite"], ["GET", "/v1/users"],
];

test("a field officer's own screens can call what they need", () => {
  const refused = OPEN.filter(([m, p]) => !isRouteAllowedForRole(FO, m, p)).map(([m, p]) => `${m} ${p}`);
  assert.deepEqual(refused, []);
});

test("a field officer cannot call money, analysis, the evidence library, visuals or management routes", () => {
  const open = CLOSED.filter(([m, p]) => isRouteAllowedForRole(FO, m, p)).map(([m, p]) => `${m} ${p}`);
  assert.deepEqual(open, []);
});

test("every other role is unrestricted by this list", () => {
  assert.deepEqual(Object.keys(ROLE_ROUTE_ALLOWLISTS), [FO]);
  for (const role of ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"]) {
    assert.equal(isRestrictedToRoutes(role), false, role);
    for (const [m, p] of CLOSED) assert.ok(isRouteAllowedForRole(role, m, p), `${role} ${m} ${p}`);
  }
});

test("audit mode logs what would be refused and lets it through; enforce mode refuses", async () => {
  const logs = [];
  const req = (url, method = "GET") => ({ tenant: { role: FO }, url, method, log: { warn: (o, msg) => logs.push([o, msg]) } });
  const before = process.env.ROLE_ROUTE_MODE;
  try {
    process.env.ROLE_ROUTE_MODE = "audit";
    await roleRouteAccessMiddleware(req(`${P}/finance?x=1`), {});
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0].path, `${P}/finance`);
    await roleRouteAccessMiddleware(req(`${P}/work-plan`), {});
    assert.equal(logs.length, 1, "an allowed route is not logged");
    process.env.ROLE_ROUTE_MODE = "enforce";
    await assert.rejects(roleRouteAccessMiddleware(req(`${P}/finance`), {}), /not part of your work/);
    await roleRouteAccessMiddleware(req(`${P}/work-plan`), {});
    await roleRouteAccessMiddleware({ tenant: { role: "ADMIN" }, url: `${P}/finance`, method: "GET", log: { warn() {} } }, {});
  } finally {
    if (before === undefined) delete process.env.ROLE_ROUTE_MODE; else process.env.ROLE_ROUTE_MODE = before;
  }
});
