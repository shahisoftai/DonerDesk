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

import { attributionSectionTitle, attributionSentences, placeAttribution } from "../dist/index.js";

test("attribution goes to a dedicated section, else the first top-level non-annex section", () => {
  assert.equal(attributionSectionTitle([{ title: "Introduction", level: 1 }, { title: "Acknowledgements", level: 1 }]), "Acknowledgements");
  assert.equal(attributionSectionTitle([{ title: "Annex A", level: 1, inputType: "ANNEX" }, { title: "Introduction", level: 1 }]), "Introduction");
  assert.equal(attributionSectionTitle([]), undefined);
});

test("prompt block names the one section that carries the attribution", () => {
  const block = visibilityPromptBlock("European Union", "ReliefWorks", "Introduction");
  assert.ok(block.some((l) => l.includes('only in the section titled "Introduction"')));
  assert.ok(!block.some((l) => l.includes("opening narrative")));
});

test("attribution sentences include full quoted disclaimers but not short quoted tokens", () => {
  const eu = attributionSentences("European Union");
  assert.equal(eu[0], "This project is funded by the European Union.");
  assert.ok(eu.some((s) => s.startsWith("Views and opinions expressed")));
  assert.ok(!eu.includes("EU"));
  const usaid = attributionSentences("USAID", "ReliefWorks");
  assert.ok(usaid.some((s) => s.includes("The contents are the responsibility of ReliefWorks")));
  assert.deepEqual(attributionSentences(""), []);
});

test("placeAttribution keeps the attribution in exactly one section", () => {
  const sentences = attributionSentences("European Union");
  const repeated = `This project is funded by the European Union. In March, 600 people took part.\n\n${sentences[1]}\n\nNext steps follow.`;
  assert.equal(placeAttribution(repeated, sentences, false), "In March, 600 people took part.\n\nNext steps follow.");
  assert.equal(placeAttribution("In March, 600 people took part.", sentences, true), "This project is funded by the European Union.\n\nIn March, 600 people took part.");
  assert.equal(placeAttribution(repeated, sentences, true), repeated);
  assert.equal(placeAttribution("No attribution here.", sentences, false), "No attribution here.");
});

test("placeAttribution does not add the English sentence to a non-English report's carrier section", () => {
  const sentences = attributionSentences("European Union");
  const fr = "Ce projet est financé par l'Union européenne. Deux activités ont eu lieu.";
  assert.equal(placeAttribution(fr, sentences, true, false), fr);
  assert.equal(placeAttribution(`This project is funded by the European Union. ${fr}`, sentences, false, false), fr);
});
