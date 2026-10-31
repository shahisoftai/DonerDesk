// Phase 36: the wizard speaks four languages. English is the source; every other language must say the same things in the
// same shape: nothing missing, nothing extra, no dropped placeholder, no raw code in a sentence.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREA_KEYS } from "@donordesk/contracts";
import { SETUP_COPY_BY_LOCALE, copyFor } from "../../src/features/project-setup/copy/index.ts";
import { localeDirection, LOCALES } from "../../src/features/i18n/domain/locales.ts";

const en = SETUP_COPY_BY_LOCALE.en;
const OTHERS = LOCALES.filter((l) => l !== "en");

const A = "§a§", B = "§b§", C = "§c§";
/** Calls a wording function with recognisable probes: the result must carry every probe the English one does. */
function probe(fn: (...args: never[]) => string, path: string): string {
  if (/problems\./.test(path)) return (fn as unknown as (p: Record<string, string>) => string)({ code: A, date: B, start: A, end: B });
  return (fn as unknown as (...a: string[]) => string)(A, B, C);
}

function compare(source: unknown, other: unknown, path: string, problems: string[]) {
  if (typeof source === "function") {
    if (typeof other !== "function") { problems.push(`${path}: not a function`); return; }
    const want = probe(source as never, path);
    const got = probe(other as never, path);
    for (const token of [A, B, C]) if (want.includes(token) && !got.includes(token)) problems.push(`${path}: lost ${token}`);
    if (!got.trim()) problems.push(`${path}: empty`);
    return;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(other) || other.length !== source.length) { problems.push(`${path}: expected ${source.length} items`); return; }
    source.forEach((item, i) => compare(item, other[i], `${path}[${i}]`, problems));
    return;
  }
  if (source && typeof source === "object") {
    if (!other || typeof other !== "object") { problems.push(`${path}: missing`); return; }
    const a = Object.keys(source).sort(), b = Object.keys(other).sort();
    if (a.join("|") !== b.join("|")) problems.push(`${path}: keys differ (${a.filter((k) => !b.includes(k)).join(",")} missing; ${b.filter((k) => !a.includes(k)).join(",")} extra)`);
    for (const k of a) compare((source as Record<string, unknown>)[k], (other as Record<string, unknown>)[k], `${path}.${k}`, problems);
    return;
  }
  if (typeof other !== "string" || other.trim() === "") problems.push(`${path}: empty or not text`);
}

for (const locale of OTHERS) {
  test(`${locale}: says everything English says, in the same shape, with every placeholder kept`, () => {
    const problems: string[] = [];
    compare(en, SETUP_COPY_BY_LOCALE[locale], locale, problems);
    assert.deepEqual(problems, []);
  });
}

test("every language fully instructs every step: checks, do's, don'ts, options and a tip", () => {
  for (const locale of LOCALES) {
    const c = SETUP_COPY_BY_LOCALE[locale];
    for (const area of SETUP_AREA_KEYS) {
      const g = c.areas[area];
      assert.ok(g.short && g.title && g.lead && g.tip, `${locale} ${area}`);
      assert.ok(g.checks.length >= 2 && g.dos.length >= 2 && g.donts.length >= 2 && g.options.length >= 2, `${locale} ${area} is fully instructed`);
    }
    assert.ok(c.create.checks.length >= 2 && c.create.dos.length >= 2 && c.create.donts.length >= 2, `${locale} create`);
  }
});

test("no sentence in any language names a code, an id or a snake_case key", () => {
  const raw = /\b[a-z]+_[a-z_]+\b|\b[0-9a-f]{8}-[0-9a-f]{4}\b|\b[A-Z]{2,}_[A-Z_]+\b/;
  const found: string[] = [];
  const walk = (x: unknown, path: string) => {
    if (typeof x === "string") { if (raw.test(x)) found.push(`${path}: ${x}`); }
    else if (typeof x === "function") return;
    else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
  };
  for (const locale of LOCALES) walk(SETUP_COPY_BY_LOCALE[locale], locale);
  assert.deepEqual(found, []);
});

test("the languages are the app's four, Arabic reads right to left, and an unknown language falls back to English", () => {
  assert.deepEqual([...LOCALES].sort(), ["ar", "en", "es", "fr"]);
  assert.equal(localeDirection("ar"), "rtl");
  for (const l of ["en", "fr", "es"] as const) assert.equal(localeDirection(l), "ltr");
  assert.equal(copyFor("xx" as never), en);
});

test("a count or a name is written into the sentence in every language", () => {
  for (const locale of LOCALES) {
    const c = SETUP_COPY_BY_LOCALE[locale];
    assert.match(c.nav.stepOf(3, 11), /3/);
    assert.match(c.nav.stepOf(3, 11), /11/);
    assert.match(c.upload.filesOf(2, 5), /2/);
    assert.match(c.upload.removeFile("Plan.docx"), /Plan\.docx/);
    assert.match(c.review.problems.LOGFRAME_PARENT_UNKNOWN({ code: "1.1" }), /1\.1/);
    assert.match(c.review.problems.END_BEFORE_START({ start: "2027-03-01", end: "2027-01-01" }), /2027-03-01/);
    assert.match(c.done.documentMoved("00-Project-Documents"), /00-Project-Documents/);
  }
});
