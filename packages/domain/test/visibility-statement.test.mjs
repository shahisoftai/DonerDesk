import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERIC_VISIBILITY_STATEMENT,
  VISIBILITY_STATEMENTS,
  buildVisibilityStatement,
  resolveVisibilityStatement,
  visibilityPromptBlock,
} from "../dist/index.js";

test("catalog resolves EU donors to the exact EU attribution sentence", () => {
  const resolved = resolveVisibilityStatement("European Union — Directorate-General for ECHO");
  assert.equal(resolved.donorKey, "european-union");
  assert.equal(buildVisibilityStatement("EU Civil Protection & ECHO"), "This project is funded by the European Union.");
});

test("catalog resolves USAID and renders the organization placeholder", () => {
  const statement = buildVisibilityStatement("USAID Bureau for Humanitarian Assistance", "ReliefWorks International");
  assert.ok(statement.startsWith("This document is made possible by the generous support of the American people"));
  assert.ok(statement.includes("through the United States Agency for International Development (USAID)"));
});

test("FCDO, Global Fund, GCF, and UNHCR each resolve to their family", () => {
  assert.equal(resolveVisibilityStatement("UK International Development").donorKey, "uk-fcdo");
  assert.equal(resolveVisibilityStatement("The Global Fund").donorKey, "global-fund");
  assert.equal(resolveVisibilityStatement("Green Climate Fund").donorKey, "gcf");
  assert.equal(resolveVisibilityStatement("UNHCR").donorKey, "unhcr");
});

test("unknown donors resolve to the generic statement with the donor name substituted", () => {
  assert.equal(resolveVisibilityStatement("Acme Foundation").donorKey, "generic");
  assert.equal(
    buildVisibilityStatement("Acme Foundation"),
    "This project is implemented with the support of Acme Foundation.",
  );
});

test("alias matching is word-boundary safe", () => {
  // "eu" must not match inside unrelated words.
  assert.equal(resolveVisibilityStatement("Neumann Foundation").donorKey, "generic");
  assert.equal(resolveVisibilityStatement("European Union Delegation").donorKey, "european-union");
});

test("prompt block contains the exact sentence and usage rules; empty for unknown donors", () => {
  const block = visibilityPromptBlock("European Union", "ReliefWorks");
  assert.ok(block.some((line) => line.includes('This project is funded by the European Union.')));
  assert.ok(block.some((line) => line.toLowerCase().includes("do not")));
  assert.deepEqual(visibilityPromptBlock(""), []);
  assert.deepEqual(visibilityPromptBlock("   "), []);
});

test("every catalog entry is well-formed (SRP: data integrity is owned here)", () => {
  for (const entry of VISIBILITY_STATEMENTS) {
    assert.ok(entry.donorKey.length >= 3);
    assert.ok(entry.aliases.length > 0);
    assert.ok(entry.statement.trim().endsWith("."));
    assert.ok(entry.rules.length > 0);
  }
  assert.equal(GENERIC_VISIBILITY_STATEMENT.aliases.length, 0);
});
