import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBannedPhrases,
  assertNoWorkflowVocabulary,
  assertNoInternalIds,
  integrityIssues,
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

test("assertWordCount: minWords shortfall is a warning, maxWords is hard", () => {
  const section = { ...baseSection, content: "one two three" };
  const short = assertWordCount(section, { minWords: 10, maxWords: 20 });
  assert.equal(short.ok, true, "padding to a minimum produces speculative prose");
  assert.match(short.warnings.join(" "), /minWords/);
  assert.equal(assertWordCount(section, { maxWords: 2 }).ok, false);
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


test("assertNoWorkflowVocabulary flags the reporting tool's own vocabulary and nothing else", () => {
  const rows = [
    ["Readiness scoring for this final report stands at 0.0, so the report requires verification before approval.", true],
    ["The report has three open checklist items.", true],
    ["The ministry gave its approval for the borehole sites.", false],
    ["The checklist used by field teams covers 12 sanitation criteria.", false],
  ];
  for (const [content, hit] of rows) {
    const result = assertNoWorkflowVocabulary({ ...baseSection, content });
    assert.equal(!result.ok, hit, content);
    if (hit) assert.equal(result.issues[0]?.startsWith("WORKFLOW_VOCABULARY"), true);
  }
});

test("runAll reports workflow vocabulary as a quality issue, not an integrity one", () => {
  const result = runAll({ ...baseSection, content: "Data quality is good. Readiness score is 80." });
  assert.equal(result.issues.some((i) => i.startsWith("WORKFLOW_VOCABULARY")), true);
});

// Same table as `INTERNAL_ID_CASES` in apps/workers/tests/test_ai_reporter_quality.py: Python and TS stay in lockstep.
const INTERNAL_ID_CASES = [
  ["Attendance was recorded in evidence 3f2a9c1e-7b44-4d0e-9a51-0c6d2e8f1a77.", true],
  ["See ev-14 and ev:a91c for the register.", true],
  ["Source: record-2291 and chunk_88.", true],
  ["The supervision checklist is in Mentorship_Log_March.pdf.", true],
  ["The evidence ids are listed below.", true],
  ["Reference 9f86d081884c7d659a2feaa0c55ad015 was used.", true],
  ["Indicator HL-1.1b reached 142 caregivers, against IND-1 and OUT-3.", false],
  ["The team kept good record-keeping and evidence of attendance.", false],
  ["Award number 72062326CA00001 funds the work, signed on 20260927150000.", false],
  ["Counselling reached 142 caregivers; a PDF summary was shared with the ministry.", false],
];

test("assertNoInternalIds flags ids, uuids and file names and nothing else (mirrors the worker)", () => {
  for (const [content, hit] of INTERNAL_ID_CASES) {
    const result = assertNoInternalIds({ ...baseSection, content });
    assert.equal(!result.ok, hit, content);
    if (hit) {
      assert.equal(result.issues[0]?.startsWith("INTERNAL_ID"), true);
      assert.equal(integrityIssues(result).length, 1, "an id in donor text earns the retry");
    }
  }
});
