import assert from "node:assert/strict";
import test from "node:test";
import { scoreSimilarity, bestMatch, stem } from "../dist/index.js";

test("stem collapses common inflections to the same form", () => {
  assert.equal(stem("trained"), stem("training"));
  assert.equal(stem("teacher"), stem("teachers"));
  assert.equal(stem("recruited"), stem("recruiting"));
});

test("scoreSimilarity recognises a natural paraphrase as similar", () => {
  const claim = "The project trained 58 teachers this period.";
  const evidence = "58 teachers were recruited and completed training during the reporting period.";
  const score = scoreSimilarity(claim, evidence);
  assert.ok(score > 0.3, `expected meaningful overlap, got ${score}`);
});

test("scoreSimilarity is symmetric", () => {
  const a = "Learning centres established in Cox's Bazar";
  const b = "Cox's Bazar learning centre establishment";
  assert.equal(scoreSimilarity(a, b), scoreSimilarity(b, a));
});

test("scoreSimilarity returns 0 for unrelated text", () => {
  const score = scoreSimilarity("Teacher training attendance sheet", "Flooding risk assessment report");
  assert.equal(score, 0);
});

test("scoreSimilarity returns 0 for empty input", () => {
  assert.equal(scoreSimilarity("", "anything"), 0);
  assert.equal(scoreSimilarity("anything", ""), 0);
});

test("bestMatch picks the highest-scoring candidate and is undefined when nothing matches", () => {
  const candidates = [
    { id: "a", text: "Evidence checklist for training records" },
    { id: "b", text: "Teacher training attendance sheet Q2 2026" },
  ];
  const match = bestMatch("teachers attended training", candidates);
  assert.equal(match?.id, "b");

  const noMatch = bestMatch("completely unrelated topic xyz", [{ id: "c", text: "flooding risk report" }]);
  assert.equal(noMatch, undefined);
});
