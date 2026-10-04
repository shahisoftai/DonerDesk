import test from "node:test";
import assert from "node:assert/strict";
import { deterministicBlueprintTable } from "../dist/index.js";
import { blueprintSectionsFor } from "@donordesk/domain";

test("activity participants table is built from the recorded numbers", () => {
  const md = deterministicBlueprintTable("bp:activity:participants", [
    { activityId: "a1", activityTitle: "Training | day 1", participantsTotal: 38, participantsMale: 10, participantsFemale: 28 },
    { activityId: "a2", activityTitle: "Outreach", participantsTotal: 600, participantsChildren: 540 },
  ]);
  const lines = md.split("\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[2], "| Training \\| day 1 | 38 | 10 | 28 | — | — |");
  assert.equal(lines[3], "| Outreach | 600 | — | — | 540 | — |");
});

test("no deterministic table for other sections or without activities", () => {
  assert.equal(deterministicBlueprintTable("bp:activity:next", [{ activityId: "a", activityTitle: "x" }]), undefined);
  assert.equal(deterministicBlueprintTable("bp:activity:participants", []), undefined);
  assert.equal(deterministicBlueprintTable(undefined, []), undefined);
});

test("blueprint titles never trip the AI worker's executive-summary classifier", () => {
  for (const reportType of ["MONTHLY", "ACTIVITY", "SITUATION", "CUSTOM"]) {
    const titles = blueprintSectionsFor({ reportType, scope: { sequence: 2 }, activities: [{ id: "a", title: "Water point repair" }] }).map((s) => s.title);
    assert.ok(!titles.some((t) => /overview|abstract/i.test(t)), `${reportType}: ${titles.join(", ")}`);
  }
});

import { scopeIndicatorData } from "../dist/index.js";

test("indicator data is scoped per report type", () => {
  const findings = [{ indicatorId: "i1" }, { indicatorId: "i2" }];
  const updates = [{ indicatorId: "i1" }, { indicatorId: "i2" }];
  const acts = [{ indicatorId: "i2" }, {}];
  assert.deepEqual(scopeIndicatorData("MONTHLY", acts, findings, updates), { findings, updates });
  assert.deepEqual(scopeIndicatorData("ACTIVITY", acts, findings, updates), { findings: [{ indicatorId: "i2" }], updates: [{ indicatorId: "i2" }] });
  assert.deepEqual(scopeIndicatorData("ACTIVITY", [{}], findings, updates), { findings: [], updates: [] });
  assert.deepEqual(scopeIndicatorData("SITUATION", acts, findings, updates), { findings: [], updates: [] });
});

import { SectionGenerationService } from "../dist/index.js";

test("section service keeps the donor attribution in exactly one section", async () => {
  const service = new SectionGenerationService({ generate: () => "id" }, { recordRun: async () => ({ ok: true }) }, {}, {}, { record: async () => {} });
  const plan = { sections: [{ templateSectionId: "bp:activity:overview", title: "Introduction", level: 1, inputType: "NARRATIVE" }, { templateSectionId: "bp:activity:next", title: "Next Steps", level: 1, inputType: "NARRATIVE" }] };
  const reportContext = { project: { donorName: "European Union (DG INTPA)", implementingOrganization: "Sahel Health" } };
  const write = async (planSection, content) => {
    const generator = { model: { modelId: "m" }, generateSection: async () => ({ section: { content }, usedFallback: false }) };
    const out = await service.draft({ ctx: {}, runId: "r", plan, inputs: { activities: [], reportContext }, reportingProfileSnapshot: {}, generator, draftedSections: [] }, "s", planSection);
    return out.section.content;
  };
  assert.equal(await write(plan.sections[1], "This project is funded by the European Union. Continue outreach."), "Continue outreach.");
  assert.equal(await write(plan.sections[0], "Two activities took place."), "This project is funded by the European Union.\n\nTwo activities took place.");
});

import { InferredReportPlanner } from "../dist/index.js";

test("participants table headers follow the report language", () => {
  const md = deterministicBlueprintTable("bp:activity:participants", [{ activityId: "a", activityTitle: "Formation", participantsTotal: 5 }], "fr");
  assert.equal(md.split("\n")[0], "| Activité | Total | Hommes | Femmes | Enfants | Personnes handicapées |");
});

test("the planner carries a blueprint section's canonical title only when the title is translated", async () => {
  const planner = new InferredReportPlanner({ generate: () => "plan" });
  const plan = async (language) => (await planner.plan({
    reportingPeriodId: "p", projectId: "x", tenantId: { toString: () => "t" },
    templateSections: blueprintSectionsFor({ reportType: "MONTHLY", scope: {}, language }),
    templateVersion: 1, profileVersion: 1,
    reportingProfileSnapshot: { tone: "FORMAL", language: language ?? "en", formattingRules: [], sectionOverrides: {} },
  })).value.sections;
  assert.ok((await plan("en")).every((s) => s.canonicalTitle === undefined));
  const fr = await plan("fr");
  assert.equal(fr[0].title, "Le mois en bref");
  assert.equal(fr[0].canonicalTitle, "This Month at a Glance");
});

test("section service: a French report's carrier section keeps the writer's French attribution only", async () => {
  const service = new SectionGenerationService({ generate: () => "id" }, { recordRun: async () => ({ ok: true }) }, {}, {}, { record: async () => {} });
  const plan = { sections: [{ templateSectionId: "bp:activity:overview", title: "Introduction", level: 1, inputType: "NARRATIVE" }] };
  const content = "Ce projet est financé par l'Union européenne. Deux activités ont eu lieu.";
  const generator = { model: { modelId: "m" }, generateSection: async () => ({ section: { content }, usedFallback: false }) };
  const out = await service.draft({ ctx: {}, runId: "r", plan, inputs: { activities: [], reportContext: { project: { donorName: "European Union" } } }, reportingProfileSnapshot: { language: "fr" }, generator, draftedSections: [] }, "s", plan.sections[0]);
  assert.equal(out.section.content, content);
});

import { resolveGenerationActivities, FINAL_REPORT_ACTIVITY_CAP } from "../dist/index.js";

const tenantStub = {};
const act = (id, date, status = "ACCEPTED") => ({ id, status, activityDate: new Date(`${date}T00:00:00Z`) });
const activitiesRepo = (own, all) => ({
  findByReportingPeriod: async () => ({ ok: true, value: own }),
  findByProject: async () => ({ ok: true, value: all }),
});
const period = (reportType) => ({ id: "p", reportType, scope: {}, projectId: "proj", duration: { start: new Date("2028-10-01"), end: new Date("2028-12-31") } });

test("a final report draws on the project's accepted activities from every period", async () => {
  const own = [act("c", "2028-11-01", "DRAFT")];
  const all = [act("a", "2027-02-01"), act("b", "2028-03-01"), act("d", "2028-05-01", "DRAFT"), act("c", "2028-11-01", "DRAFT")];
  const result = await resolveGenerationActivities(activitiesRepo(own, all), period("FINAL"), tenantStub);
  assert.deepEqual(result.value.map((a) => a.id), ["a", "b", "c"]);
});

test("a final report's activity list is capped to the most recent records, oldest first", async () => {
  const all = Array.from({ length: FINAL_REPORT_ACTIVITY_CAP + 5 }, (_, i) => act(`a${i}`, `2027-01-${String((i % 28) + 1).padStart(2, "0")}`));
  const withDates = all.map((a, i) => ({ ...a, activityDate: new Date(Date.UTC(2027, 0, 1 + i)) }));
  const result = await resolveGenerationActivities(activitiesRepo([], withDates), period("FINAL"), tenantStub);
  assert.equal(result.value.length, FINAL_REPORT_ACTIVITY_CAP);
  assert.equal(result.value[0].id, "a5");
  assert.equal(result.value.at(-1).id, `a${FINAL_REPORT_ACTIVITY_CAP + 4}`);
});

test("other report types keep their own activities only", async () => {
  const own = [act("c", "2028-11-01", "DRAFT")];
  const result = await resolveGenerationActivities(activitiesRepo(own, [act("a", "2027-02-01")]), period("ANNUAL"), tenantStub);
  assert.deepEqual(result.value.map((a) => a.id), ["c"]);
});

test("situation figures table: exactly the entered figures, with the previous report's when there is one", () => {
  const current = { affectedPopulation: [{ group: "Households", figure: "1,500", source: "OCHA", asOf: "2028-05-06" }, { group: "Children | under 5", figure: "300" }] };
  const first = deterministicBlueprintTable("bp:situation:needs", [], undefined, { current });
  assert.equal(first.split("\n")[0], "| Group | Figure | Source | As of |");
  assert.equal(first.split("\n")[2], "| Households | 1,500 | OCHA | 2028-05-06 |");
  assert.equal(first.split("\n")[3], "| Children \\| under 5 | 300 | — | — |");

  const previous = { situationDate: "2028-05-01", affectedPopulation: [{ group: " households ", figure: "1,200" }] };
  const followUp = deterministicBlueprintTable("bp:situation:needs", [], undefined, { current, previous });
  assert.equal(followUp.split("\n")[0], "| Group | Figure | Previously reported | Source | As of |");
  assert.equal(followUp.split("\n")[2], "| Households | 1,500 | 1,200 (2028-05-01) | OCHA | 2028-05-06 |");
  assert.equal(followUp.split("\n")[3], "| Children \\| under 5 | 300 | — | — | — |");
});

test("no situation table without entered figures, for other sections, or in translation", () => {
  assert.equal(deterministicBlueprintTable("bp:situation:needs", [], undefined, { current: {} }), undefined);
  assert.equal(deterministicBlueprintTable("bp:situation:needs", [], undefined, undefined), undefined);
  assert.equal(deterministicBlueprintTable("bp:situation:response", [], undefined, { current: { affectedPopulation: [{ group: "A", figure: "1" }] } }), undefined);
  const fr = deterministicBlueprintTable("bp:situation:needs", [], "fr", { current: { affectedPopulation: [{ group: "A", figure: "1" }] } });
  assert.equal(fr.split("\n")[0], "| Groupe | Chiffre | Source | En date du |");
});
