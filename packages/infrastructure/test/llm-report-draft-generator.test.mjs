import assert from "node:assert/strict";
import test from "node:test";
import { parseSections, buildSectionSpecificGuidance } from "../dist/llm/llm-report-draft-generator.js";

test("parseSections extracts claims and sourceReferences from LLM output", () => {
  const raw = JSON.stringify({
    sections: [
      {
        title: "Executive Summary",
        content: "Delivered 30 sessions during the period.",
        claims: [
          {
            text: "Delivered 30 sessions",
            type: "NUMERIC",
            proposedSources: [{ evidenceId: "ev-1", chunkId: "chunk-1", sourceText: "session log" }],
          },
        ],
        sourceReferences: [
          { type: "evidence", id: "ev-1", label: "Session log" },
          { type: "indicator", id: "ind-1", label: "IND-1" },
        ],
      },
    ],
  });

  const sections = parseSections(raw);
  assert.ok(sections, "expected parsed sections");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Executive Summary");
  assert.equal(sections[0].content, "Delivered 30 sessions during the period.");
  assert.equal(sections[0].claims.length, 1);
  assert.equal(sections[0].claims[0].type, "NUMERIC");
  assert.equal(sections[0].claims[0].proposedSources[0].evidenceId, "ev-1");
  assert.equal(sections[0].sourceReferences.length, 2);
  assert.equal(sections[0].sourceReferences[0].type, "evidence");
});

test("parseSections strips markdown fences", () => {
  const raw = "```json\n" + JSON.stringify({ sections: [{ title: "A", content: "Text" }] }) + "\n```";
  const sections = parseSections(raw);
  assert.ok(sections);
  assert.equal(sections[0].title, "A");
  assert.equal(sections[0].content, "Text");
});

test("parseSections falls back to FACTUAL for unknown claim type", () => {
  const raw = JSON.stringify({
    sections: [{ title: "A", content: "Text", claims: [{ text: "c", type: "WEIRD" }] }],
  });
  const sections = parseSections(raw);
  assert.ok(sections);
  assert.equal(sections[0].claims[0].type, "FACTUAL");
});

test("parseSections rejects empty content", () => {
  const raw = JSON.stringify({ sections: [{ title: "A", content: "   " }] });
  assert.equal(parseSections(raw), null);
});

test("parseSections rejects non-array sections", () => {
  // Pure prose doesn't parse as JSON, so the lenient parser now treats it as
  // a single narrative section (the user-facing fix for "AI rejected clean
  // prose output"). Only malformed JSON shapes and empty sections arrays
  // still fall back to the stub generator.
  assert.ok(Array.isArray(parseSections("not json")));
  assert.equal(parseSections(JSON.stringify({ sections: "nope" })), null);
  assert.equal(parseSections(JSON.stringify({ sections: [] })), null);
});

test("parseSections extracts JSON wrapped in prose preamble (MiniMax style)", () => {
  const json = JSON.stringify({ sections: [{ title: "A", content: "Text" }] });
  const raw = `Here is the JSON you requested:\n${json}\nThat is all.`;
  const sections = parseSections(raw);
  assert.ok(sections, "expected wrapped JSON to be extracted");
  assert.equal(sections[0].title, "A");
  assert.equal(sections[0].content, "Text");
});

test("parseSections never stores a raw JSON blob as narrative content", () => {
  // A JSON blob that parses but has no usable sections array is null (stub),
  // never the raw JSON stored as a narrative section.
  assert.equal(parseSections(`{"sections": "nope"}`), null);
  assert.equal(parseSections(`{"foo": "bar"}`), null);
  assert.equal(parseSections(`{"sections": []}`), null);
  // A TRUNCATED JSON blob is now recovered via completeTruncatedJson: the
  // salvaged partial content is returned as a real section instead of a stub.
  const truncated = `{"sections": [{"title": "Executive Summary", "content": "The prog`;
  const recovered = parseSections(truncated, [{ title: "Executive Summary" }]);
  assert.ok(recovered, "expected truncated JSON to be recovered");
  assert.equal(recovered[0].content, "The prog");
});

test("parseSections extracts JSON from fenced block with surrounding text", () => {
  const json = JSON.stringify({ sections: [{ title: "A", content: "Text" }] });
  const raw = `Output:\n\`\`\`json\n${json}\n\`\`\``;
  const sections = parseSections(raw);
  assert.ok(sections);
  assert.equal(sections[0].title, "A");
  assert.equal(sections[0].content, "Text");
});

test("parseSections repairs MiniMax literal newlines inside JSON string values", () => {
  // MiniMax (and other LLMs) emit unescaped control chars inside JSON string
  // values (e.g. a real newline in "content"). Strict JSON forbids this; the
  // parser must repair it instead of falling back to the stub.
  const raw = `{
  "sections": [
    {
      "title": "Programme Overview",
      "content": "Line one of the narrative.
Line two of the narrative.
Line three.",
      "claims": [],
      "sourceReferences": []
    }
  ]
}`;
  const sections = parseSections(raw, [{ title: "Programme Overview" }]);
  assert.ok(sections, "expected repaired JSON to parse");
  assert.equal(sections[0].title, "Programme Overview");
  assert.ok(sections[0].content.startsWith("Line one of the narrative."), "first line preserved");
  assert.ok(sections[0].content.includes("Line two"), "second line preserved");
  assert.ok(sections[0].content.includes("Line three"), "third line preserved");
});

test("parseSections repairs literal tabs and carriage returns inside string values", () => {
  const raw = `{
  "sections": [
    {
      "title": "A",
      "content": "col1\tcol2\r\nrow",
      "claims": [],
      "sourceReferences": []
    }
  ]
}`;
  const sections = parseSections(raw, [{ title: "A" }]);
  assert.ok(sections, "expected repaired JSON to parse");
  assert.ok(sections[0].content.includes("col1"));
  assert.ok(sections[0].content.includes("col2"));
  assert.ok(sections[0].content.includes("row"));
});

test("parseSections completes JSON truncated by the output token limit", () => {
  // A section longer than maxTokens: the response ends mid-string and with
  // unclosed structures. The parser must complete it instead of returning null.
  const raw = `{
  "sections": [
    {
      "title": "Progress Against Indicators",
      "content": "| Indicator | Value | Target | Method |
| OUT-1 | 8 centres | 120 | SUM |
| OUT-2 | 521 kits | 15000 | SUM |",
      "claims": [
        {
          "text": "Eight learning centres established",
          "type": "NUMERIC",
          "proposedSources": [{"evidenceId": "e1", "chunkId": "e1:0", "sourceText": "Field reports"}]
        }
      ],
      "sourceReferences": [
        {"type": "indicator", "id": "i1", "label": "OUT-1"}
      ]
    }
  ]}`;
  // Cut mid-way: inside the sourceReferences array, before closing braces.
  const cut = raw.slice(0, raw.indexOf('"sourceReferences"') + 120);
  const sections = parseSections(cut, [{ title: "Progress Against Indicators" }]);
  assert.ok(sections, "expected truncated JSON to be completed and parsed");
  assert.equal(sections[0].title, "Progress Against Indicators");
  assert.ok(sections[0].content.includes("OUT-1"));
});

test("parseSections completes JSON truncated mid-string", () => {
  // Cut mid-string inside the content value.
  const raw = `{"sections":[{"title":"A","content":"The narrative goes on`;
  const sections = parseSections(raw, [{ title: "A" }]);
  assert.ok(sections, "expected mid-string truncation to be completed");
  assert.equal(sections[0].title, "A");
  assert.ok(sections[0].content.startsWith("The narrative"));
});

test("parseSections tolerates invalid optional claims metadata when content is valid", () => {
  const sections = parseSections(JSON.stringify({
    sections: [{
      title: "Challenges",
      content: "No verified challenge narrative was recorded.",
      claims: "invalid optional metadata",
      sourceReferences: { invalid: true },
    }],
  }));
  assert.ok(sections);
  assert.equal(sections[0].content, "No verified challenge narrative was recorded.");
  assert.deepEqual(sections[0].claims, []);
  assert.deepEqual(sections[0].sourceReferences, []);
});

test("buildSectionSpecificGuidance: distinguishes indicator-performance annexes from evidence-checklist annexes", () => {
  const input = { reportContext: {} };
  const indicatorAnnex = { title: "Annex A: Indicator Performance Table" };
  const evidenceAnnex = { title: "Annex B: Evidence Checklist" };

  const indicatorGuidance = buildSectionSpecificGuidance(indicatorAnnex, input).join("\n");
  assert.ok(
    indicatorGuidance.includes("Code, Indicator, Unit, Baseline, Target"),
    "indicator-performance annex must get the findings-table instruction",
  );
  assert.ok(
    !indicatorGuidance.includes("Do NOT produce an indicator findings table"),
    "indicator-performance annex must not get the evidence-checklist instruction",
  );

  const evidenceGuidance = buildSectionSpecificGuidance(evidenceAnnex, input).join("\n");
  assert.ok(
    evidenceGuidance.includes("File, Type, Verification status, Confidentiality"),
    "evidence-checklist annex must get the evidence-file-table instruction",
  );
  assert.ok(
    !evidenceGuidance.includes("Code, Indicator, Unit, Baseline, Target"),
    "evidence-checklist annex must NOT be told to reproduce the indicator findings table (this was the production bug)",
  );
});

import { reportTypeGuidance, buildFinanceBlock } from "../dist/llm/llm-report-draft-generator.js";

test("reportTypeGuidance: tone and scope rules follow the kind of report", () => {
  assert.match(reportTypeGuidance("MONTHLY").join(" "), /short, factual/);
  assert.match(reportTypeGuidance("ANNUAL").join(" "), /progress since the project started/);
  assert.match(reportTypeGuidance("SEMI_ANNUAL").join(" "), /previous report/);
  assert.match(reportTypeGuidance("FINAL").join(" "), /retrospectively/);
  for (const t of ["QUARTERLY", "ACTIVITY", "SITUATION", "CUSTOM", undefined]) assert.deepEqual(reportTypeGuidance(t), []);
});

test("section guidance carries the report-type rules; cumulative guidance only with life-of-project findings", () => {
  const section = { title: "Cumulative Progress Against Project Targets" };
  const base = { reportContext: { period: { reportType: "ANNUAL", startDate: "2028-01-01", endDate: "2028-12-31" } }, verifiedFindings: [] };
  assert.match(buildSectionSpecificGuidance(section, base).join("\n"), /longer period/);
  assert.doesNotMatch(buildSectionSpecificGuidance(section, base).join("\n"), /lifeOfProject/);
  const withLife = { ...base, verifiedFindings: [{ lifeOfProject: { value: "7000" } }] };
  assert.match(buildSectionSpecificGuidance(section, withLife).join("\n"), /lifeOfProject\.value/);
});

test("buildFinanceBlock: only when verified figures were supplied, so other prompts stay byte-identical", () => {
  assert.deepEqual(buildFinanceBlock({}), []);
  const block = buildFinanceBlock({ finance: { currency: "USD", budget: "100", expenditure: "40", balance: "60", burnRatePercent: "40", lines: [] } });
  assert.match(block[0], /Financial Figures \(verified.*USD/);
  assert.match(block[1], /"burnRatePercent":"40"/);
});

test("a donor template's financial section is told a verified table is added; blueprint sections rely on their own instructions", () => {
  const finance = { currency: "USD", budget: "100", expenditure: "40", balance: "60", burnRatePercent: "40", lines: [] };
  const input = { reportContext: {}, verifiedFindings: [], finance };
  const donor = buildSectionSpecificGuidance({ title: "3. Financial Report" }, input).join("\n");
  assert.match(donor, /added automatically below your text/);
  assert.doesNotMatch(buildSectionSpecificGuidance({ title: "3. Financial Report", templateSectionId: "bp:quarterly:finance" }, input).join("\n"), /added automatically below your text/);
  assert.doesNotMatch(buildSectionSpecificGuidance({ title: "3. Financial Report" }, { ...input, finance: undefined }).join("\n"), /added automatically below your text/);
  assert.doesNotMatch(buildSectionSpecificGuidance({ title: "Lessons Learned" }, input).join("\n"), /added automatically below your text/);
});
