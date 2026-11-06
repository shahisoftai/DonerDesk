import { test } from "node:test";
import assert from "node:assert/strict";
import { PCW_ENGLISH } from "../../src/features/project-setup/pcw/copy.ts";
import { PCW_AR } from "../../src/features/project-setup/pcw/copy-ar.ts";
import { PCW_ES } from "../../src/features/project-setup/pcw/copy-es.ts";
import { PCW_FR } from "../../src/features/project-setup/pcw/copy-fr.ts";
import { SETUP_REQUIREMENTS } from "@donordesk/domain";

const OTHERS = { fr: PCW_FR, es: PCW_ES, ar: PCW_AR } as const;

/** Every string in a copy tree, with its path; functions are called with probe arguments. */
function strings(node: unknown, path = ""): Array<[string, string]> {
  if (typeof node === "string") return [[path, node]];
  if (typeof node === "function") {
    // Each function takes a different shape (a count, two words, a list); try the shapes in turn.
    const shapes: unknown[][] = [[3], [3, 2], [3, "uno", "dos"], ["Label", ["a"]], ["x", "y", "z"], ["a", "b"]];
    for (const args of shapes) {
      try {
        const probe = (node as (...a: unknown[]) => unknown)(...args);
        if (typeof probe === "string") return [[`${path}()`, probe]];
      } catch { /* try the next shape */ }
    }
    return [];
  }
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

test("every language answers every key the English copy has, with no empty sentence", () => {
  const english = strings(PCW_ENGLISH.copy).map(([p]) => p);
  for (const [name, bundle] of Object.entries(OTHERS)) {
    const got = new Map(strings(bundle.copy));
    for (const p of english) assert.ok((got.get(p) ?? "").trim().length > 0, `${name}: ${p} has no text`);
  }
});

test("every requirement has a sentence in every language, and no sentence shows a code or an id", () => {
  for (const [name, bundle] of Object.entries({ en: PCW_ENGLISH, ...OTHERS })) {
    for (const r of SETUP_REQUIREMENTS) {
      for (const code of r.codes ?? []) {
        const text = bundle.sentences[code as keyof typeof bundle.sentences]({ count: 2, first: "X" });
        assert.ok(text.trim().length > 0, `${name}: ${code} is empty`);
        assert.ok(!/[a-z]+\.[a-z]+\.[a-z]+|[a-f0-9]{8}-[a-f0-9]{4}/i.test(text), `${name}: ${code} shows a raw token`);
      }
    }
  }
});

test("slide names and leads exist in every language", () => {
  for (const [name, bundle] of Object.entries(OTHERS)) {
    for (const [slide, v] of Object.entries(bundle.slides)) assert.ok(v.label && v.lead, `${name}: ${slide}`);
    assert.deepEqual(Object.keys(bundle.slides), Object.keys(PCW_ENGLISH.slides));
  }
});

test("the same placeholders appear in a translated sentence as in the English one", () => {
  for (const [name, bundle] of Object.entries(OTHERS)) {
    for (const code of Object.keys(PCW_ENGLISH.sentences) as Array<keyof typeof PCW_ENGLISH.sentences>) {
      const en = PCW_ENGLISH.sentences[code]({ count: 2, first: "FIRSTNAME" });
      const tr = bundle.sentences[code]({ count: 2, first: "FIRSTNAME" });
      if (en.includes("FIRSTNAME")) assert.ok(tr.includes("FIRSTNAME"), `${name}: ${code} lost the name`);
    }
  }
});
