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
