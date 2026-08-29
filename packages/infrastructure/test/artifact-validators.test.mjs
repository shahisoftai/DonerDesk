import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBannedPhrases,
  assertMandatoryQuestionsAnswered,
  assertNumericExactness,
  assertRepetition,
  assertTableCitation,
  assertWordCount,
  runAll,
} from "../dist/ai/artifact-validators.js";

const baseSection = {
  sectionId: "s-1",
  title: "Achievements",
  content: "We reached 500 beneficiaries. Coverage data is preliminary.",
  claims: [],
  sourceReferences: [],
};

test("assertNumericExactness passes when the verified number is present", () => {
  const result = assertNumericExactness(baseSection, new Set(["500"]));
  assert.equal(result.ok, true);
});

test("assertNumericExactness fails when the number is paraphrased", () => {
  const section = { ...baseSection, content: "Approximately five hundred beneficiaries." };
  const result = assertNumericExactness(section, new Set(["500"]));
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.startsWith("NUMERIC_PARAPHRASE"), true);
});

test("assertNumericExactness also checks artifact cell content", () => {
  const section = {
    ...baseSection,
    artifacts: [
      {
        kind: "TABLE",
        ordinal: 0,
        payload: {
          columns: [
            { key: "indicator", label: "Indicator" },
            { key: "value", label: "Value" },
          ],
          rows: [
            {
              cells: ["Reach", "1,200"],
              sourceReferences: [{ type: "evidence", id: "ev-1", label: "Field report" }],
            },
          ],
        },
        sourceReferences: [],
      },
    ],
  };
  const result = assertNumericExactness(section, new Set(["1,200"]));
  assert.equal(result.ok, true);
});

test("assertTableCitation fails when a row has no sourceReferences", () => {
  const section = {
    ...baseSection,
    artifacts: [
      {
        kind: "TABLE",
        ordinal: 0,
        payload: {
          columns: [{ key: "code", label: "Code" }],
          rows: [{ cells: ["IND-1"], sourceReferences: [] }],
        },
        sourceReferences: [],
      },
    ],
  };
  const result = assertTableCitation(section);
  assert.equal(result.ok, false);
});

test("assertTableCitation passes when every non-empty row cites evidence", () => {
  const section = {
    ...baseSection,
    artifacts: [
      {
        kind: "TABLE",
        ordinal: 0,
        payload: {
          columns: [{ key: "code", label: "Code" }],
          rows: [
            { cells: ["IND-1"], sourceReferences: [{ type: "evidence", id: "ev-1", label: "Field" }] },
            { cells: ["IND-2"], sourceReferences: [{ type: "evidence", id: "ev-2", label: "Field" }] },
          ],
        },
        sourceReferences: [],
      },
    ],
  };
  assert.equal(assertTableCitation(section).ok, true);
});

test("assertBannedPhrases flags transformative", () => {
  const section = { ...baseSection, content: "The workshop was transformative." };
  const result = assertBannedPhrases(section);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.startsWith("BANNED_PHRASE"), true);
});

test("assertBannedPhrases allows clean prose", () => {
  const section = { ...baseSection, content: "The workshop was well attended." };
  assert.equal(assertBannedPhrases(section).ok, true);
});

test("assertWordCount enforces min and max", () => {
  const section = { ...baseSection, content: "one two three" };
  const result = assertWordCount(section, { minWords: 10, maxWords: 20 });
  assert.equal(result.ok, false);
});

test("assertWordCount passes when in band", () => {
  const section = { ...baseSection, content: "one two three four five six seven eight nine ten" };
  assert.equal(assertWordCount(section, { minWords: 5, maxWords: 20 }).ok, true);
});

test("assertRepetition flags overlap with a prior section sentence", () => {
  const section = {
    ...baseSection,
    content: "Expenditure reached EUR 240,000 against a budget of EUR 300,000. Other facts follow here.",
  };
  const result = assertRepetition(section, [
    "Expenditure reached EUR 240,000 against a budget of EUR 300,000.",
  ]);
  assert.equal(result.ok, false);
});

test("assertMandatoryQuestionsAnswered fails when a question is missing", () => {
  const section = {
    ...baseSection,
    qa: [
      {
        question: "What was the audit status?",
        answer: "Unaudited.",
        sourceReferences: [{ type: "template", id: "t-1", label: "ECHO template" }],
      },
    ],
  };
  const result = assertMandatoryQuestionsAnswered(section, {
    mandatoryQuestions: ["What was the audit status?", "Which partner submitted the report?"],
  });
  assert.equal(result.ok, false);
});

test("assertMandatoryQuestionsAnswered passes when every question is sourced", () => {
  const section = {
    ...baseSection,
    qa: [
      { question: "Audit status?", answer: "Unaudited.", sourceReferences: [{ type: "template", id: "t-1" }] },
      { question: "Partner?", answer: "Lead implementer.", sourceReferences: [{ type: "template", id: "t-1" }] },
    ],
  };
  assert.equal(
    assertMandatoryQuestionsAnswered(section, {
      mandatoryQuestions: ["Audit status?", "Partner?"],
    }).ok,
    true,
  );
});

test("runAll aggregates issues for the same section", () => {
  const section = {
    ...baseSection,
    content: "The workshop was transformative. Approximately twelve hundred people attended.",
  };
  const result = runAll(section, {
    verifiedNumbers: new Set(["1,200"]),
    mandatoryQuestions: [],
  });
  assert.equal(result.ok, false);
  const joined = result.issues.join(" | ");
  assert.match(joined, /BANNED_PHRASE/);
  assert.match(joined, /NUMERIC_PARAPHRASE/);
});

test("runAll passes for a fully compliant table section", () => {
  const section = {
    ...baseSection,
    title: "Achievements",
    content: "We reached 500 beneficiaries. 320 women and 180 children. Coverage is preliminary.",
    artifacts: [
      {
        kind: "TABLE",
        ordinal: 0,
        payload: {
          columns: [
            { key: "indicator", label: "Indicator" },
            { key: "value", label: "Value" },
          ],
          rows: [
            { cells: ["Reach", "500"], sourceReferences: [{ type: "evidence", id: "ev-1" }] },
            { cells: ["Female", "320"], sourceReferences: [{ type: "evidence", id: "ev-1" }] },
            { cells: ["Male", "180"], sourceReferences: [{ type: "evidence", id: "ev-1" }] },
          ],
        },
        sourceReferences: [],
      },
    ],
  };
  const result = runAll(section, { verifiedNumbers: new Set(["500", "320", "180"]) });
  assert.equal(result.ok, true, result.issues.join(" | "));
});

