import assert from "node:assert/strict";
import test from "node:test";
import { BLOCK_KINDS, BLOCK_FAMILIES, CANVAS_MODES, definitionFor } from "@donordesk/domain/contexts/canvas/index.js";
import { FULL_LOCALES as LOCALES } from "../../src/features/i18n/domain/locales.ts";
import { en } from "../../src/features/i18n/messages/en.ts";
import { MESSAGES } from "../../src/features/i18n/messages/index.ts";
import { GLOSSARY, GLOSSARY_USE } from "../../src/features/i18n/messages/glossary.ts";
import { blockLabelKey, familyLabelKey } from "../../src/features/canvas/domain/canvas-copy.ts";

const text = (locale: (typeof LOCALES)[number], key: string): string => (MESSAGES[locale] as Record<string, string>)[key]!;
const MAX_LABEL = 44; // fits a block's header on a phone without wrapping

test("every block, group and mode has a name in every language, and the definition points at it", () => {
  for (const kind of BLOCK_KINDS) assert.equal(definitionFor(kind)!.labelKey, blockLabelKey(kind), kind);
  const keys = [...BLOCK_KINDS.map(blockLabelKey), ...BLOCK_FAMILIES.map(familyLabelKey), ...CANVAS_MODES.map((m) => `canvas.mode.${m}`), "canvas.reportTranslation"];
  for (const key of keys) assert.ok(key in en, `English has ${key}`);
  for (const locale of LOCALES) for (const key of keys) {
    const value = text(locale, key);
    assert.ok(value && value.trim() === value && !/\s{2,}/.test(value), `${locale}: ${key} is clean text`);
  }
});

test("a block's name fits its header in every language and is not the same as another block's", () => {
  for (const locale of LOCALES) {
    const names = BLOCK_KINDS.map((k) => text(locale, blockLabelKey(k)));
    for (const [i, name] of names.entries()) assert.ok(name.length <= MAX_LABEL, `${locale}: ${BLOCK_KINDS[i]} is ${name.length} characters`);
    assert.equal(new Set(names).size, names.length, `${locale}: two blocks share a name`);
  }
});

test("the glossary has every term in every language, and the labels that name a term use it", () => {
  const FULL = LOCALES;
  for (const [term, byLocale] of Object.entries(GLOSSARY)) for (const locale of FULL) assert.ok(byLocale[locale].length > 0 && byLocale[locale].every((f) => f.trim().length > 0), `${term} in ${locale}`);
  for (const [key, terms] of Object.entries(GLOSSARY_USE)) {
    assert.ok(key in en, `${key} exists`);
    for (const locale of FULL) for (const term of terms) {
      const label = text(locale, key).toLowerCase();
      assert.ok(GLOSSARY[term][locale].some((form) => label.includes(form.toLowerCase())), `${locale}: ${key} ("${label}") should use the glossary word for ${term}`);
    }
  }
});
