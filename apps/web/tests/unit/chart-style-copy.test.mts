import assert from "node:assert/strict";
import test from "node:test";
import { STYLE_FIELDS, STYLE_GROUPS } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { STYLE_COPY_LANGUAGES, helpKey, styleCopyOf, styleGroupLabel, styleHelp, styleLabel, styleWord } from "../../src/features/charts/domain/style-copy.ts";

const AXIS = /^(xAxis|yAxis)\./;

test("every style option, group, choice word and help text is translated into French, Spanish and Arabic", () => {
  const words = new Set<string>();
  for (const f of STYLE_FIELDS) if (f.type === "choice") f.options.forEach((o) => words.add(o));
  for (const lang of STYLE_COPY_LANGUAGES) {
    const c = styleCopyOf(lang);
    for (const f of STYLE_FIELDS) {
      if (AXIS.test(f.path)) assert.ok(c.axis[f.path.split(".")[1]!], `${lang} axis ${f.path}`);
      else assert.ok(c.fields[f.path], `${lang} ${f.path}`);
      if (f.help) assert.ok(c.help[helpKey(f.path)], `${lang} help ${f.path}`);
    }
    for (const g of STYLE_GROUPS) assert.ok(c.groups[g.group], `${lang} group ${g.group}`);
    for (const w of words) assert.ok(c.words[w], `${lang} word ${w}`);
    assert.ok(c.axisNames.x && c.axisNames.y);
    // nothing stale: no key for an option that no longer exists
    for (const k of Object.keys(c.fields)) assert.ok(STYLE_FIELDS.some((f) => f.path === k), `${lang} has a stale key ${k}`);
  }
});

test("a translation is not the English text, keeps its placeholders-free form, and is never a raw token", () => {
  for (const lang of STYLE_COPY_LANGUAGES) {
    const c = styleCopyOf(lang);
    for (const [k, v] of Object.entries(c.fields)) {
      assert.ok(v.trim().length > 2, `${lang} ${k}`);
      assert.ok(!/[_]|\b[a-z]+\.[a-z]+\b/.test(v), `${lang} ${k} looks like a raw key: ${v}`);
    }
    const english = STYLE_FIELDS.filter((f) => !AXIS.test(f.path)).filter((f) => c.fields[f.path] === f.label);
    assert.ok(english.length <= 4, `${lang} leaves ${english.map((f) => f.path).join(", ")} in English`);
  }
});

test("labels follow the language; English is the table's own text; an unknown language falls back to English", () => {
  const f = STYLE_FIELDS.find((x) => x.path === "bars.radius")!;
  assert.equal(styleLabel("en", f), "Rounded ends");
  assert.equal(styleLabel("fr", f), "Extrémités arrondies");
  assert.equal(styleLabel("ar", f), "أطراف مستديرة");
  const x = STYLE_FIELDS.find((y) => y.path === "xAxis.prefix")!;
  assert.equal(styleLabel("es", x), "Eje horizontal: antes de cada valor");
  assert.equal(styleLabel("en", x), x.label);
  assert.equal(styleGroupLabel("fr", "bars", "Bars"), "Barres");
  assert.equal(styleGroupLabel("en", "bars", "Bars"), "Bars");
  assert.equal(styleWord("es", "ROUND_RECT", "Round rect"), "Rectángulo redondeado");
  assert.equal(styleWord("en", "ROUND_RECT", "Round rect"), "Round rect");
  assert.match(styleHelp("fr", STYLE_FIELDS.find((y) => y.path === "yAxis.prefix")!)!, /signe monétaire/);
  assert.equal(styleHelp("fr", STYLE_FIELDS.find((y) => y.path === "title.size")!), undefined);
});
