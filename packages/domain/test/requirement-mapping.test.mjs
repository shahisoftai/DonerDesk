import assert from "node:assert/strict";
import test from "node:test";
import {
  matchRequirementToSection,
  mandatoryQuestionText,
  requirementTopic,
  stampPlanSectionsWithRequirements,
} from "../dist/index.js";

const req = (over) => ({
  id: "r-1",
  key: "SECTION:executive-summary",
  kind: "SECTION",
  required: true,
  severity: "BLOCKING",
  sourceReference: { sourceType: "DONOR_PACK", sourceId: "pack-1", version: 1, label: "pack" },
  ...over,
});

const sections = [
  { templateSectionId: "s1", title: "Executive Summary", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] },
  { templateSectionId: "s2", title: "Progress Against Results", inputType: "ACHIEVEMENT", required: true, mandatoryQuestions: [], evidenceNeeds: ["indicator records"] },
  { templateSectionId: "s3", title: "Additional Comments", inputType: "TEXT", required: false, mandatoryQuestions: [], evidenceNeeds: [] },
];

test("requirementTopic strips the kind prefix and normalizes dashes", () => {
  assert.equal(requirementTopic(req({ key: "QUESTION:safeguarding-psea" })), "safeguarding psea");
  assert.equal(requirementTopic(req({ key: "plain-key" })), "plain key");
});

test("SECTION requirement stamps keys and guidance on the matched section", () => {
  const stamped = stampPlanSectionsWithRequirements(sections, [
    req({
      key: "SECTION:executive-summary",
      guidance: "Summarize the quarter's outcomes first, then delivery context.",
    }),
  ]);
  assert.deepEqual(stamped[0].requirementKeys, ["SECTION:executive-summary"]);
  assert.deepEqual(stamped[0].requirementGuidance, ["Summarize the quarter's outcomes first, then delivery context."]);
  // Unmatched sections stay untouched.
  assert.equal(stamped[1].requirementKeys, undefined);
  assert.equal(stamped[2].requirementKeys, undefined);
});

test("QUESTION requirement adds a mandatory question and falls back to the last section", () => {
  const question = "Report any safeguarding or PSEA concerns and the actions taken.";
  const stamped = stampPlanSectionsWithRequirements(sections, [
    req({ key: "QUESTION:safeguarding-psea", kind: "QUESTION", guidance: question }),
  ]);
  assert.deepEqual(stamped[2].mandatoryQuestions, [question]);
  assert.deepEqual(stamped[2].requirementKeys, ["QUESTION:safeguarding-psea"]);
});

test("QUESTION without guidance prettifies the topic into the question text", () => {
  assert.equal(mandatoryQuestionText(req({ key: "QUESTION:safeguarding-psea", kind: "QUESTION" })), "Safeguarding psea");
});

test("DECLARATION falls back to the first section when nothing matches", () => {
  const stamped = stampPlanSectionsWithRequirements(sections, [
    req({ key: "DECLARATION:eu-attribution", kind: "DECLARATION", guidance: "State 'This project is funded by the European Union.' verbatim." }),
  ]);
  assert.deepEqual(stamped[0].requirementKeys, ["DECLARATION:eu-attribution"]);
});

test("matching is deterministic and idempotent across runs", () => {
  const requirements = [
    req({ key: "SECTION:executive-summary", guidance: "Outcomes first." }),
    req({ key: "INDICATOR:progress", kind: "INDICATOR" }),
  ];
  const once = stampPlanSectionsWithRequirements(sections, requirements);
  const twice = stampPlanSectionsWithRequirements(once, requirements);
  assert.deepEqual(JSON.parse(JSON.stringify(twice)), JSON.parse(JSON.stringify(once)));
});

test("input sections are never mutated", () => {
  const snapshot = JSON.parse(JSON.stringify(sections));
  stampPlanSectionsWithRequirements(sections, [
    req({ key: "SECTION:progress-results", guidance: "Narrate progress." }),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(sections)), snapshot);
});

test("matchRequirementToSection breaks ties toward the earliest section", () => {
  const requirement = req({ key: "SECTION:results" });
  const match = matchRequirementToSection(requirement, sections);
  assert.equal(match.sectionIndex, 1); // "Progress Against Results" wins on title tokens
  assert.ok(match.score > 0);
});

test("requirements with no topical evidence leave sections unstamped (no forced placement)", () => {
  const stamped = stampPlanSectionsWithRequirements(sections, [
    req({ key: "ANNEX:certification", kind: "ANNEX" }),
  ]);
  assert.equal(stamped[0].requirementKeys, undefined);
  assert.equal(stamped[1].requirementKeys, undefined);
  assert.equal(stamped[2].requirementKeys, undefined);
});
