import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_REACHABLE_PAGES, canReachProjectPage, isRestrictedRole, landingPageFor, tabsReachableBy } from "../../src/features/projects/domain/role-project-pages.ts";
import { stagesFor } from "../../src/features/projects/domain/role-project-stages.ts";
import { PROJECT_STAGES as PROJECT_TABS, locateProjectPage, subNavFor } from "../../src/features/projects/domain/project-stages.ts";
import { capabilitiesForRole, ROLES } from "../../src/lib/shared/capabilities.ts";
import { canReachAppPage, ROLE_REACHABLE_APP_PAGES } from "../../src/features/navigation/domain/role-app-pages.ts";
import { navFor } from "../../src/features/navigation/domain/role-navigation.ts";
import { visibleFormTabs } from "../../src/features/collection/domain/form-tabs.ts";
import { availableKinds, RECORD_KINDS } from "../../src/features/record/domain/record-kinds.ts";
import { assignmentHref, openAssignments, summariseAssignments } from "../../src/features/collection/domain/my-assignments.ts";

const ROLE_LIST = ROLES as readonly string[];

test("only the field officer is restricted; every other role reaches every page", () => {
  for (const role of ROLE_LIST) {
    assert.equal(isRestrictedRole(role), role === "FIELD_OFFICER", role);
    if (role === "FIELD_OFFICER") continue;
    for (const tab of PROJECT_TABS) for (const page of tab.pages) assert.ok(canReachProjectPage(role, page.path), `${role} ${page.path}`);
  }
});

test("a field officer reaches their activities, their forms and the photo upload, nothing else", () => {
  for (const ok of ["/activities", "/activities/abc", "/activities/new", "/forms", "/forms/f1", "/evidence/new"]) {
    assert.ok(canReachProjectPage("FIELD_OFFICER", ok), ok);
  }
  for (const no of ["", "/logframe", "/indicators", "/places", "/datasets", "/evidence", "/evidence/e1", "/beneficiaries", "/finance", "/settings", "/team", "/setup", "/reports", "/reports/r1", "/templates", "/compliance", "/data", "/enter", "/import", "/collect", "/review", "/periods", "/visuals", "/charts", "/maps", "/report-builder", "/management-report", "/adaptations", "/ask", "/infographics", "/unknown", "/activitiesX"]) {
    assert.ok(!canReachProjectPage("FIELD_OFFICER", no), no);
  }
});

test("every page a field officer may reach sits under a page the project navigation knows", () => {
  const known = PROJECT_TABS.flatMap((t) => t.pages.flatMap((p) => [p.path, ...(p.also ?? [])])).filter((p) => p !== "");
  for (const path of ROLE_REACHABLE_PAGES.FIELD_OFFICER ?? []) assert.ok(known.some((k) => path === k || path.startsWith(`${k}/`)), path);
});

test("the project front page sends a field officer to their forms, or their activities when the project has none", () => {
  assert.equal(landingPageFor("FIELD_OFFICER", true), "/forms");
  assert.equal(landingPageFor("FIELD_OFFICER", false), "/activities");
  for (const role of ROLE_LIST.filter((r) => r !== "FIELD_OFFICER")) assert.equal(landingPageFor(role, true), null, role);
  assert.equal(landingPageFor(null, true), null);
  assert.ok(canReachProjectPage("FIELD_OFFICER", landingPageFor("FIELD_OFFICER", true) ?? "x") && canReachProjectPage("FIELD_OFFICER", landingPageFor("FIELD_OFFICER", false) ?? "x"), "the landing page is itself reachable");
});

test("the field officer's bar has no More, and no tab it cannot open", () => {
  const bar = stagesFor(PROJECT_TABS, "FIELD_OFFICER", "plan");
  assert.deepEqual(bar.more, []);
  assert.deepEqual(bar.shown.map((t) => t.key), ["plan", "collect"]);
  assert.deepEqual(tabsReachableBy("FIELD_OFFICER", PROJECT_TABS).map((t) => t.key), ["plan", "collect"]);
  for (const role of ROLE_LIST.filter((r) => r !== "FIELD_OFFICER")) {
    const b = stagesFor(PROJECT_TABS, role, "home");
    assert.equal(b.shown.length + b.more.length, PROJECT_TABS.length, role);
  }
});

test("the sub-navigation of a restricted role lists only reachable pages", () => {
  const plan = locateProjectPage("/activities");
  const sub = subNavFor(plan.tab, { facts: new Set(), capabilities: capabilitiesForRole("FIELD_OFFICER"), current: plan.page, reachable: (p) => canReachProjectPage("FIELD_OFFICER", p) });
  assert.deepEqual([...sub.shown, ...sub.more].map((p) => p.path), ["/activities", "/forms"]);
  const data = locateProjectPage("/forms");
  const dsub = subNavFor(data.tab, { facts: new Set(["FORMS"]), capabilities: capabilitiesForRole("FIELD_OFFICER"), current: data.page, reachable: (p) => canReachProjectPage("FIELD_OFFICER", p) });
  assert.deepEqual([...dsub.shown, ...dsub.more].map((p) => p.path), ["/activities", "/forms"]);
});

test("the field officer holds neither money nor analysis; every other role holds both", () => {
  for (const role of ROLE_LIST) {
    const caps = capabilitiesForRole(role);
    assert.equal(caps.has("finance.view"), role !== "FIELD_OFFICER", role);
    assert.equal(caps.has("results.view"), role !== "FIELD_OFFICER", role);
  }
});

test("Record: a field officer is offered the form, a photo and an activity, and no expense page", () => {
  const caps = capabilitiesForRole("FIELD_OFFICER");
  const keys = availableKinds({ has: (c) => caps.has(c), hasForms: true }).map((k) => k.key);
  assert.ok(keys.includes("FORM") && keys.includes("FILE") && keys.includes("ACTIVITY"));
  assert.ok(!keys.includes("EXPENSE"), "the Finance page is closed to them");
  assert.ok(!keys.includes("NUMBER"));
  // no forms in the project: the form kind is not offered
  assert.ok(!availableKinds({ has: (c) => caps.has(c), hasForms: false }).some((k) => k.key === "FORM"));
});

test("Record: nothing changes for the roles that already had the sheet", () => {
  const withIndicator = (role: string) => availableKinds({ has: (c) => capabilitiesForRole(role).has(c), hasForms: true }).map((k) => k.key);
  assert.ok(withIndicator("PROJECT_MANAGER").includes("EXPENSE") && withIndicator("PROJECT_MANAGER").includes("FORM") && withIndicator("PROJECT_MANAGER").includes("NUMBER"));
  assert.deepEqual(withIndicator("VIEWER"), []);
  assert.equal(RECORD_KINDS.filter((k) => k.requires).length, 1);
});

const a = (id: string, place: string, status: "TO_DO" | "IN_PROGRESS" | "DONE" | "NOT_VISITED", dueOn?: string) => ({ id, formId: "f", projectId: "p", placeId: id, placeName: place, path: place, assigneeId: "u", status, ...(dueOn ? { dueOn } : {}) });

test("my facilities: started first, then the earliest due day, then the name; finished ones are not queued", () => {
  const list = [a("1", "Zeta", "TO_DO", "2026-12-02"), a("2", "Alpha", "TO_DO"), a("3", "Beta", "IN_PROGRESS", "2026-12-09"), a("4", "Gamma", "DONE"), a("5", "Delta", "TO_DO", "2026-11-30"), a("6", "Eps", "NOT_VISITED")];
  assert.deepEqual(openAssignments(list).map((x) => x.id), ["3", "5", "1", "2"]);
  assert.deepEqual(summariseAssignments(list), { toDo: 3, started: 1, done: 1, notVisited: 1 });
  assert.equal(assignmentHref({ projectId: "p1", formId: "f9", placeId: "pl 1" }), "/projects/p1/forms/f9?place=pl%201");
  assert.deepEqual(openAssignments([]), []);
});

test("app pages: a field officer opens their own screens and nothing else; every other role is unrestricted", () => {
  for (const ok of ["/dashboard", "/inbox", "/projects", "/projects/p1", "/projects/p1/forms", "/more", "/waiting", "/field", "/help/how-it-works", "/settings/security", "/logout", "/inbox?tab=updates"]) assert.ok(canReachAppPage("FIELD_OFFICER", ok), ok);
  for (const no of ["/visuals", "/visuals/charts/p1", "/reports", "/compliance", "/downloads", "/where-we-work", "/programmes", "/portfolio", "/settings", "/settings/billing", "/team", "/audit", "/evidence", "/projects/new", "/projects/new/wizard", "/dashboards", "/places"]) assert.ok(!canReachAppPage("FIELD_OFFICER", no), no);
  for (const role of ROLE_LIST.filter((r) => r !== "FIELD_OFFICER")) for (const p of ["/visuals", "/reports", "/settings", "/portfolio", "/projects/new"]) assert.ok(canReachAppPage(role, p), `${role} ${p}`);
  assert.ok(!canReachAppPage("FIELD_OFFICER", ""), "no path known: a restricted role is refused, never let through");
  assert.ok(canReachAppPage("ADMIN", ""), "an unrestricted role is never refused");
  assert.deepEqual(Object.keys(ROLE_REACHABLE_APP_PAGES), ["FIELD_OFFICER"]);
});

test("navigation: a field officer's sidebar is Home, Inbox and Projects", () => {
  const items = navFor({ role: "FIELD_OFFICER", capabilities: capabilitiesForRole("FIELD_OFFICER"), external: false } as never).map((i: { label: string }) => i.label);
  assert.deepEqual(items, ["Home", "Inbox", "Projects"]);
});

test("form tabs: a field officer fills in; reviewers, managers and number-enterers get the rest", () => {
  const base = { published: true, assessment: true, hasMappings: true, pending: 2, canEdit: false, canSubmit: false, canReview: false, canEnter: false };
  const keys = (o: Partial<typeof base>) => visibleFormTabs({ ...base, ...o }).map(([k]) => k);
  assert.deepEqual(keys({ canSubmit: true }), ["fill"]);
  assert.deepEqual(keys({ canSubmit: true, canReview: true }), ["fill", "facilities", "records", "totals"]);
  assert.deepEqual(keys({ canSubmit: true, canEdit: true }), ["fill", "facilities", "records", "totals", "share", "connect"]);
  assert.deepEqual(keys({ canSubmit: true, canEnter: true }), ["fill", "records", "totals"]);
  assert.deepEqual(keys({ published: false, canEdit: true }), ["facilities".slice(0, 0)].filter(Boolean).concat(["records", "totals", "connect"]));
  assert.deepEqual(keys({}), [], "a person with no form permission sees no tab");
  assert.equal(visibleFormTabs({ ...base, canSubmit: true, canReview: true }).find(([k]) => k === "records")?.[1], "Assessments (2 waiting)");
});

import { mustChooseFromAssigned, offerFacilities } from "../../src/features/collection/domain/assessment-flow.ts";

test("a field worker chooses only from the facilities given to them; a manager, or a worker with none given, from every one", () => {
  const places = [{ id: "a", name: "Alpha", path: "A" }, { id: "b", name: "Beta", path: "B" }, { id: "c", name: "Gamma", path: "C" }];
  const given = [{ id: "x", formId: "f", placeId: "b", status: "TO_DO" as const, dueOn: "2026-12-01" }, { id: "y", formId: "f", placeId: "c", status: "DONE" as const }];
  assert.equal(mustChooseFromAssigned(false, given), true);
  assert.equal(mustChooseFromAssigned(true, given), false, "a manager sees every facility");
  assert.equal(mustChooseFromAssigned(false, []), false, "a survey nobody was assigned stays open to choose from");
  assert.deepEqual(offerFacilities(places, given, "", 60, true).map((o) => o.id), ["b"], "only the open assignments, never the others or the finished ones");
  assert.deepEqual(offerFacilities(places, given, "", 60, false).map((o) => o.id), ["b", "a", "c"], "without the rule: his first, then the rest");
  assert.deepEqual(offerFacilities(places, [{ ...given[0]!, status: "DONE" as const }], "", 60, true), [], "everything done: nothing to start");
});
