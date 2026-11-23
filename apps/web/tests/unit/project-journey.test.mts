import test from "node:test";
import assert from "node:assert/strict";
import { NEXT_STEP_RULES, journeyStage, nextStepFor, type JourneyFacts } from "../../src/features/projects/domain/journey.ts";
import { CHECKLIST_RULES, setupChecklist, type ChecklistFacts } from "../../src/features/projects/domain/setup-checklist.ts";
import { ADD_DATA_OPTIONS, addDataOptionsFor } from "../../src/features/projects/domain/add-data-options.ts";
import { PROJECT_STAGES, locateProjectPage, projectCrumbs, subNavFor } from "../../src/features/projects/domain/project-stages.ts";
import { OVERVIEW_HIDDEN_BY_DEFAULT, resolveOverviewLayout } from "../../src/features/projects/domain/overview-layout.ts";
import { OVERVIEW_SECTION_ORDER } from "../../src/features/projects/domain/overview-sections.ts";

const full: ChecklistFacts = { indicators: 3, periods: 1, teamSize: 4, hasSites: true, planningVisible: true, plannedActivities: 5, templates: 1, hasBudget: true, risks: 2 };
const all = new Set(["logframe.edit", "project.edit", "reporting.create", "team.invite", "workplan.manage", "reporting.edit", "finance.view", "risk.raise"]);
const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({ projectId: "p", needsYou: [], checklist: null, periods: 1, canCreatePeriod: true, nextDeadlineDays: null, nextDeadlineTitle: null, readiness: null, ...over });

test("next step: the first rule that applies wins, in table order", () => {
  assert.deepEqual(NEXT_STEP_RULES.map((r) => r.id), ["URGENT", "ESSENTIAL_SETUP", "NO_PERIOD", "REPORT_SOON", "WAITING", "SETUP"]);
  const urgent = nextStepFor(facts({ needsYou: [{ title: "a", href: "/a", urgent: false }, { title: "b", href: "/b", urgent: true }] }));
  assert.equal(urgent?.id, "URGENT"); assert.equal(urgent?.text, "b"); assert.equal(urgent?.others, 1);
  assert.equal(nextStepFor(facts({ needsYou: [{ title: "a", href: "/a", urgent: false }] }))?.id, "WAITING");
  assert.equal(nextStepFor(facts({ periods: 0 }))?.href, "/projects/p/periods");
  assert.equal(nextStepFor(facts({ periods: 0, canCreatePeriod: false })), null, "someone who may not create a period is not sent there");
  assert.equal(nextStepFor(facts()), null);
});

test("next step: a near report that is not ready comes before waiting items, a distant or ready one does not", () => {
  const near = nextStepFor(facts({ needsYou: [{ title: "a", href: "/a", urgent: false }], nextDeadlineDays: 5, nextDeadlineTitle: "Quarterly report", readiness: 60 }));
  assert.equal(near?.id, "REPORT_SOON"); assert.match(near!.text, /due in 5 days and is 60% ready/);
  assert.equal(nextStepFor(facts({ nextDeadlineDays: -2, nextDeadlineTitle: "Q", readiness: 10 }))?.urgent, true);
  assert.equal(nextStepFor(facts({ nextDeadlineDays: 40, readiness: 10 })), null);
  assert.equal(nextStepFor(facts({ nextDeadlineDays: 3, readiness: 100 })), null);
});

test("next step: essentials come before everything but an urgent item", () => {
  const checklist = setupChecklist({ facts: { ...full, indicators: 0 }, capabilities: all, reportDueWithinDays: null });
  assert.equal(nextStepFor(facts({ checklist }))?.id, "ESSENTIAL_SETUP");
  assert.equal(nextStepFor(facts({ checklist, needsYou: [{ title: "late", href: "/l", urgent: true }] }))?.id, "URGENT");
});

test("journey stage follows what the project has", () => {
  const base = { indicators: 1, periods: 1, reviewWaiting: false, reportUnderway: false };
  assert.equal(journeyStage({ ...base, indicators: 0 }), "SET_UP");
  assert.equal(journeyStage({ ...base, periods: 0 }), "PLAN");
  assert.equal(journeyStage(base), "COLLECT");
  assert.equal(journeyStage({ ...base, reviewWaiting: true }), "REVIEW");
  assert.equal(journeyStage({ ...base, reviewWaiting: true, reportUnderway: true }), "REPORT");
});

test("checklist: every rule explains itself, items are only those the person may do, and progress counts them", () => {
  for (const r of CHECKLIST_RULES) { assert.ok(r.why.length > 20 && r.effort && r.action && r.title, r.id); assert.ok(r.path === "" || r.path.startsWith("/"), r.id); }
  assert.equal(new Set(CHECKLIST_RULES.map((r) => r.id)).size, CHECKLIST_RULES.length);
  const c = setupChecklist({ facts: full, capabilities: all, reportDueWithinDays: null });
  assert.equal(c.total, CHECKLIST_RULES.length); assert.equal(c.done, c.total); assert.equal(c.complete, true);
  const field = setupChecklist({ facts: { ...full, indicators: 0 }, capabilities: new Set(["risk.raise"]), reportDueWithinDays: null });
  assert.deepEqual(field.items.map((i) => i.id), ["risks"], "a person who can only raise risks is offered only that");
  const hidden = setupChecklist({ facts: { ...full, planningVisible: false }, capabilities: all, reportDueWithinDays: null });
  assert.ok(!hidden.items.some((i) => ["plan", "budget", "risks"].includes(i.id)), "work planning hidden = no plan, budget or risk items");
});

test("checklist: open items first; a report within 30 days moves what the report needs to the top", () => {
  const f = { ...full, indicators: 0, periods: 0, templates: 0, teamSize: 1 };
  const far = setupChecklist({ facts: f, capabilities: all, reportDueWithinDays: 90 }).items.filter((i) => !i.done).map((i) => i.id);
  assert.deepEqual(far, ["indicators", "period", "team", "template"]);
  const near = setupChecklist({ facts: { ...f, teamSize: 1 }, capabilities: all, reportDueWithinDays: 10 }).items.filter((i) => !i.done).map((i) => i.id);
  assert.deepEqual(near, ["indicators", "period", "template", "team"]);
  const items = setupChecklist({ facts: { ...full, indicators: 0 }, capabilities: all, reportDueWithinDays: null }).items;
  assert.equal(items[0]!.done, false); assert.equal(items.at(-1)!.done, true);
});

test("add data: each way needs a capability it names, and a way for a fact the project lacks is not offered", () => {
  assert.equal(new Set(ADD_DATA_OPTIONS.map((o) => o.id)).size, ADD_DATA_OPTIONS.length);
  const none = addDataOptionsFor({ capabilities: new Set(), facts: new Set() });
  assert.deepEqual(none, []);
  const fo = addDataOptionsFor({ capabilities: new Set(["activity.create", "evidence.upload", "collection.submit"]), facts: new Set() });
  assert.deepEqual(fo.map((o) => o.id), ["ACTIVITY", "FILES", "SPREADSHEET", "PEOPLE"], "no form card while the project has no form");
  assert.ok(addDataOptionsFor({ capabilities: new Set(["collection.submit"]), facts: new Set(["FORMS"]) }).some((o) => o.id === "FORM"));
  assert.deepEqual(addDataOptionsFor({ capabilities: new Set(["activity.create"]), facts: new Set(), reachable: () => false }), []);
});

test("stages: every page is in exactly one place, the first page of a stage is its link, and old addresses still locate", () => {
  const seen = new Map<string, string>();
  for (const s of PROJECT_STAGES) for (const p of s.pages) { assert.ok(!seen.has(p.path), `${p.path} is in ${seen.get(p.path)} and ${s.key}`); seen.set(p.path, s.key); }
  assert.equal(locateProjectPage("/activities/plan/abc").tab.key, "plan", "work plan items belong to Plan");
  assert.equal(locateProjectPage("/activities/new").tab.key, "collect");
  assert.equal(locateProjectPage("/activities").page.label, "Activities done");
  assert.equal(locateProjectPage("/indicators/i1").tab.key, "plan");
  assert.equal(locateProjectPage("/setup/profile").tab.key, "settings");
  assert.equal(locateProjectPage("/finance").tab.key, "finance");
  assert.equal(locateProjectPage("/data").page.label, "Data Center");
  assert.equal(locateProjectPage("").tab.key, "home");
  assert.deepEqual(projectCrumbs("p", "P", "/periods").map((c) => c.label), ["Projects", "P", "Plan", "Reporting periods"]);
  const collect = PROJECT_STAGES.find((s) => s.key === "collect")!;
  const sub = subNavFor(collect, { facts: new Set(), capabilities: new Set(["indicator.update"]), current: collect.pages[0]! });
  assert.ok(sub.shown.some((p) => p.path === "/collect") && sub.more.some((p) => p.path === "/forms"), "forms fold under More until the project has one");
});

test("home: with no saved arrangement the page opens on few parts; a saved arrangement always wins", () => {
  const def = resolveOverviewLayout(OVERVIEW_SECTION_ORDER, undefined);
  for (const p of def) assert.equal(p.hidden, OVERVIEW_HIDDEN_BY_DEFAULT.includes(p.key), p.key);
  const saved = resolveOverviewLayout(OVERVIEW_SECTION_ORDER, def.map((p) => ({ key: p.key, span: p.span, hidden: false })));
  assert.ok(saved.every((p) => !p.hidden), "a person who chose to show everything keeps it");
});
