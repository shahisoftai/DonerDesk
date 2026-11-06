import assert from "node:assert/strict";
import test from "node:test";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import { LOCALES, resolveLocale, localeFromAcceptLanguage, localeDirection, LOCALE_NAME } from "../../src/features/i18n/domain/locales.ts";
import { createTranslator, placeholdersOf } from "../../src/features/i18n/domain/translate.ts";
import { translateNav } from "../../src/features/i18n/domain/nav-keys.ts";
import { en } from "../../src/features/i18n/messages/en.ts";
import { MESSAGES, ENGLISH } from "../../src/features/i18n/messages/index.ts";
import { NAV_ENTRIES } from "../../src/features/navigation/domain/role-navigation.ts";

test("which language: the person's choice, then the organisation's, then the browser's, then English; an unknown one is ignored", () => {
  assert.equal(resolveLocale({ cookie: "ar", organisationDefault: "fr", acceptLanguage: "es" }), "ar");
  assert.equal(resolveLocale({ cookie: "xx", organisationDefault: "fr", acceptLanguage: "es" }), "fr");
  assert.equal(resolveLocale({ organisationDefault: "ur", acceptLanguage: "es-MX,es;q=0.9,en;q=0.8" }), "es");
  assert.equal(resolveLocale({ acceptLanguage: "de,it;q=0.8" }), "en");
  assert.equal(resolveLocale({}), "en");
  assert.equal(localeFromAcceptLanguage("en;q=0.5, fr-CH;q=0.9"), "fr");
  assert.equal(localeFromAcceptLanguage("fr;q=0"), null, "q=0 means not acceptable");
  assert.deepEqual(LOCALES.map((l) => [l, localeDirection(l)]), [["en", "ltr"], ["fr", "ltr"], ["es", "ltr"], ["ar", "rtl"]]);
  assert.equal(LOCALE_NAME.ar, "العربية");
});

test("every language has every English message, no more, and the same {placeholders}", () => {
  const keys = Object.keys(en);
  for (const locale of LOCALES) {
    const messages = MESSAGES[locale];
    const missing = keys.filter((k) => !(k in messages));
    assert.deepEqual(missing, [], `${locale} is missing messages`);
    for (const key of keys) {
      const [got, want] = [placeholdersOf(messages[key]!), placeholdersOf(en[key as keyof typeof en])];
      // A plural form may leave {count} out when the number is in the words ("one form", Arabic "two days"); any other message uses exactly English's.
      if (/\.(one|other)$/.test(key)) assert.ok(got.every((p) => want.includes(p)), `${locale}: ${key} uses a placeholder English does not`);
      else assert.deepEqual(got, want, `${locale}: ${key} must use the same placeholders as English`);
      assert.ok(messages[key]!.trim().length > 0, `${locale}: ${key} is empty`);
    }
    // Extra keys are allowed only as plural forms of a message English has.
    const extra = Object.keys(messages).filter((k) => !keys.includes(k));
    for (const k of extra) assert.match(k, /\.(zero|one|two|few|many|other)$/, `${locale}: ${k} is not a plural form`);
    for (const k of extra) assert.ok(keys.some((e) => e.replace(/\.(one|other)$/, "") === k.replace(/\.(zero|one|two|few|many|other)$/, "")), `${locale}: ${k} has no English counterpart`);
  }
});

test("a translated message never shows a code, an id or a snake_case key", () => {
  for (const locale of LOCALES) for (const [key, text] of Object.entries(MESSAGES[locale])) {
    // Placeholders and the date pattern the person is asked to type are not codes.
    const clean = text.replace(/\{\w+\}/g, "").replace(/YYYY-MM-DD|AAAA-MM-JJ|JPEG|PNG|WebP|PDF/g, "");
    assert.deepEqual(findRawTokens(clean), [], `${locale}: ${key}`);
  }
});

test("a message is filled in; a missing key falls back to English, then to the key itself", () => {
  const fr = createTranslator("fr", { "a.b": "Bonjour {name}" }, ENGLISH);
  assert.equal(fr.t("a.b", { name: "Amina" }), "Bonjour Amina");
  assert.equal(fr.t("common.yes"), "Yes", "not in this dictionary: English is shown");
  assert.equal(fr.t("no.such.key"), "no.such.key");
  assert.equal(fr.t("a.b"), "Bonjour {name}", "a placeholder with no value is left visible, not blanked");
});

test("plural forms follow the language: French counts 0 and 1 as one, Arabic has six forms", () => {
  const fr = createTranslator("fr", MESSAGES.fr, ENGLISH);
  assert.equal(fr.tp("field.downloaded", 1), "1 formulaire téléchargé. Vous pouvez le remplir sans connexion.");
  assert.equal(fr.tp("field.downloaded", 0), "0 formulaire téléchargé. Vous pouvez le remplir sans connexion.");
  assert.match(fr.tp("field.downloaded", 3), /^3 formulaires/);
  assert.match(fr.tp("field.downloaded", 2_000_000), /formulaires/, "a category French has but we do not write falls back to the general form");
  const ar = createTranslator("ar", MESSAGES.ar, ENGLISH);
  assert.equal(ar.tp("pack.days", 1), "تم التنزيل منذ يوم واحد.");
  assert.equal(ar.tp("pack.days", 2), "تم التنزيل منذ يومين.");
  assert.equal(ar.tp("pack.days", 5), "تم التنزيل منذ 5 أيام.");
  assert.equal(ar.tp("pack.days", 11), "تم التنزيل منذ 11 يوماً.");
  assert.equal(ar.tp("pack.days", 100), "تم التنزيل منذ 100 يوم.");
  const en2 = createTranslator("en", MESSAGES.en, ENGLISH);
  assert.equal(en2.tp("field.downloaded", 1), "Downloaded 1 form. You can fill it with no connection.");
});

test("answer problems are said in the language with their values", () => {
  const es = createTranslator("es", MESSAGES.es, ENGLISH);
  assert.equal(es.t("problem.MIN", { label: "Kits", min: 1 }), "Kits no puede ser menor que 1.");
  const ar = createTranslator("ar", MESSAGES.ar, ENGLISH);
  assert.equal(ar.t("problem.REQUIRED", { label: "الكمية" }), "الحقل «الكمية» مطلوب.");
});

test("every navigation entry has a message, in every language", () => {
  const items = Object.values(NAV_ENTRIES).map((e) => ({ href: e.href, label: e.label, group: e.group }));
  for (const locale of LOCALES) {
    const t = createTranslator(locale, MESSAGES[locale], ENGLISH).t;
    const translated = translateNav(items, t);
    for (const [i, item] of translated.entries()) {
      if (locale === "en") continue;
      assert.notEqual(item.label, items[i]!.label, `${locale}: ${items[i]!.href} is not translated`);
    }
  }
  const partner = translateNav([{ href: "/projects", label: "My projects", group: "Overview" }], createTranslator("fr", MESSAGES.fr, ENGLISH).t);
  assert.equal(partner[0]!.label, "Mes projets");
  assert.equal(translateNav([{ href: "/somewhere-else", label: "Elsewhere" }], createTranslator("fr", MESSAGES.fr, ENGLISH).t)[0]!.label, "Elsewhere", "an unlisted entry keeps its label");
});
