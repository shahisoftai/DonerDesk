import test from "node:test";
import assert from "node:assert/strict";
import { nextStep } from "../../src/features/projects/domain/next-step.ts";
import { ROLE_PROJECT_TABS, tabsFor } from "../../src/features/projects/domain/role-project-tabs.ts";
import { PROJECT_TABS } from "../../src/features/projects/domain/project-tabs.ts";

const waiting = (title: string, urgent: boolean) => ({ title, href: `/x/${title}`, urgent });

test("what's next: the most pressing item, with how many others wait", () => {
  const s = nextStep({ needsYou: [waiting("a", false), waiting("b", true), waiting("c", false)], hasPeriods: true, canCreatePeriod: true, projectId: "p" });
  assert.equal(s?.text, "b");
  assert.equal(s?.others, 2);
  assert.equal(s?.urgent, true);
  assert.equal(s?.action, "OPEN");
});

test("what's next: with nothing waiting it offers a first period only to someone who may create one, else nothing", () => {
  assert.equal(nextStep({ needsYou: [], hasPeriods: false, canCreatePeriod: true, projectId: "p" })?.href, "/projects/p/reports/new");
  assert.equal(nextStep({ needsYou: [], hasPeriods: false, canCreatePeriod: false, projectId: "p" }), null);
  assert.equal(nextStep({ needsYou: [], hasPeriods: true, canCreatePeriod: true, projectId: "p" }), null);
});

test("every role has a row, every row names real tabs, and Overview is always in the bar", () => {
  const keys = new Set(PROJECT_TABS.map((t) => t.key));
  for (const [role, tabs] of Object.entries(ROLE_PROJECT_TABS)) {
    assert.ok(tabs.includes("overview"), `${role} sees Overview`);
    for (const k of tabs) assert.ok(keys.has(k), `${role}: ${k} is a tab`);
  }
});

test("trimmed tabs go under More, never disappear, and the tab you are on stays in the bar", () => {
  // Roles that are not restricted keep every page one click away (Phase 59).
  const grants = tabsFor(PROJECT_TABS, "GRANTS_OFFICER", "overview");
  assert.ok(grants.shown.some((t) => t.key === "finance"));
  assert.ok(grants.more.some((t) => t.key === "data"));
  assert.equal(grants.shown.length + grants.more.length, PROJECT_TABS.length);
  const onData = tabsFor(PROJECT_TABS, "GRANTS_OFFICER", "data");
  assert.ok(onData.shown.some((t) => t.key === "data"), "a page opened by link keeps its tab visible");
  // The field officer is restricted (Phase 63): no More, and only the tabs they can open something in.
  const field = tabsFor(PROJECT_TABS, "FIELD_OFFICER", "overview");
  assert.deepEqual(field.more, []);
  assert.deepEqual(field.shown.map((t) => t.key), ["plan", "data"]);
  assert.equal(tabsFor(PROJECT_TABS, "ADMIN", "overview").more.length, 0);
  assert.equal(tabsFor(PROJECT_TABS, null, "overview").shown.length, ROLE_PROJECT_TABS.VIEWER.length, "no role reads as viewer");
});
