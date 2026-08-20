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
