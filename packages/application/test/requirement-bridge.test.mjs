import assert from "node:assert/strict";
import test from "node:test";
import { InferredReportPlanner } from "../dist/index.js";

/**
 * Quality remediation WS1 — requirement-pack → plan → prompt bridge.
 * The planner stamps resolved requirement keys, mandatory questions, and
 * guidance onto plan sections; without a snapshot the output is unchanged.
 */

const ids = { generate: () => "plan-1" };
const baseInput = {
  reportingPeriodId: "period-1",
  projectId: "proj-1",
  tenantId: { toString: () => "tenant-a" },
  templateVersion: 1,
  profileVersion: 1,
  reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} },
  templateSections: [
    {
      id: "ts-1",
      title: "Executive Summary",
      description: "",
      inputType: "NARRATIVE",
      required: true,
      evidenceNeeded: "",
    },
    {
      id: "ts-2",
      title: "Additional Comments",
      description: "",
      inputType: "TEXT",
      required: false,
      evidenceNeeded: "",
    },
  ],
};

const req = (over) => ({
  id: "r-1",
  key: "SECTION:executive-summary",
  kind: "SECTION",
  required: true,
  severity: "BLOCKING",
  sourceReference: { sourceType: "DONOR_PACK", sourceId: "pack-1", version: 1, label: "pack" },
  ...over,
});

test("planner stamps requirement keys, guidance, and mandatory questions when a snapshot is provided", async () => {
  const planner = new InferredReportPlanner(ids);
  const result = await planner.plan({
    ...baseInput,
    requirements: [
      req({ key: "SECTION:executive-summary", guidance: "Outcomes first, then delivery context." }),
      req({
        key: "QUESTION:safeguarding-psea",
        kind: "QUESTION",
        guidance: "Report any safeguarding or PSEA concerns and the actions taken.",
      }),
    ],
  });
  assert.equal(result.ok, true);
  const sections = result.value.sections;
  assert.deepEqual(sections[0].requirementKeys, ["SECTION:executive-summary"]);
  assert.deepEqual(sections[0].requirementGuidance, ["Outcomes first, then delivery context."]);
  assert.deepEqual(sections[0].mandatoryQuestions, []);
  // QUESTION fallback lands on the last section (donor catch-all convention).
  assert.deepEqual(sections[1].requirementKeys, ["QUESTION:safeguarding-psea"]);
  assert.deepEqual(sections[1].mandatoryQuestions, ["Report any safeguarding or PSEA concerns and the actions taken."]);
});

test("planner output is unchanged when no requirements are supplied (LSP: additive port)", async () => {
  const planner = new InferredReportPlanner(ids);
  const result = await planner.plan({ ...baseInput });
  assert.equal(result.ok, true);
  for (const section of result.value.sections) {
    assert.deepEqual(section.mandatoryQuestions, []);
    assert.equal(section.requirementKeys, undefined);
    assert.equal(section.requirementGuidance, undefined);
  }
});

test("planner still blocks when no template sections exist", async () => {
  const planner = new InferredReportPlanner(ids);
  const result = await planner.plan({ ...baseInput, templateSections: [], requirements: [req({})] });
  assert.equal(result.ok, false);
});
