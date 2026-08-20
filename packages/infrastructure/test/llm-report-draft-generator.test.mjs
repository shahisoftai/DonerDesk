import assert from "node:assert/strict";
import test from "node:test";
import { parseSections } from "../dist/llm/llm-report-draft-generator.js";

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
  // A truncated/malformed JSON blob (looks like JSON, cannot be parsed) must
  // return null so the caller falls back to the stub — never the raw JSON
  // stored as a narrative section.
  const truncated = `{"sections": [{"title": "Executive Summary", "content": "The prog`;
  assert.equal(parseSections(truncated), null);
  // A JSON blob that parses but has no usable sections array likewise is null.
  assert.equal(parseSections(`{"sections": "nope"}`), null);
  assert.equal(parseSections(`{"foo": "bar"}`), null);
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
