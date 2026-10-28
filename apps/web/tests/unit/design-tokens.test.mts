import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONTRAST_PAIRS, TOKENS, TOKEN_NAMES, VIZ_TOKENS, contrastFailures, contrastRatio, vizColor } from "../../src/features/design/domain/tokens.ts";
import { tileView } from "../../src/features/design/domain/tile-view.ts";
import { LOCALES } from "../../src/features/i18n/domain/locales.ts";
import { createTranslator } from "../../src/features/i18n/domain/translate.ts";
import { MESSAGES, ENGLISH } from "../../src/features/i18n/messages/index.ts";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const block = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("\n}", start));
};

test("contrast of white on black is 21 and of a colour with itself is 1", () => {
  assert.equal(Math.round(contrastRatio("#ffffff", "#000000")), 21);
  assert.equal(contrastRatio("#336699", "#336699"), 1);
});

test("every token pair meets its contrast minimum in light and dark (text 4.5, marks 3)", () => {
  assert.deepEqual(contrastFailures().map((f) => `${f.pair.fg} on ${f.pair.bg} (${f.mode}) ${f.ratio.toFixed(2)} < ${f.pair.min}`), []);
  assert.ok(CONTRAST_PAIRS.length >= 20);
});

test("globals.css carries exactly the token table, in both modes", () => {
  const light = block(":root");
  const dark = block(".dark");
  for (const name of TOKEN_NAMES) {
    assert.match(light, new RegExp(`--${name}: ${TOKENS[name].light};`, "i"), `${name} (light)`);
    assert.match(dark, new RegExp(`--${name}: ${TOKENS[name].dark};`, "i"), `${name} (dark)`);
  }
});

test("the page's muted text colour in the stylesheet is the checked one", () => {
  assert.match(block(":root"), /--text-muted: #586a62;/);
});

test("series colours are eight distinct colours per mode and the ninth wraps to the first", () => {
  for (const mode of ["light", "dark"] as const) {
    const colours = VIZ_TOKENS.map((v) => TOKENS[v][mode].toLowerCase());
    assert.equal(new Set(colours).size, 8);
    assert.equal(vizColor(8, mode), vizColor(0, mode));
    assert.equal(vizColor(-1, mode), vizColor(7, mode));
  }
});

test("a tile shows its content only when ready; every other state says one honest thing", () => {
  assert.equal(tileView({ status: "ready" }).showContent, true);
  for (const status of ["loading", "empty", "error", "restricted"] as const) {
    const v = tileView({ status });
    assert.equal(v.showContent, false, status);
    assert.ok(v.messageKey, status);
  }
  assert.equal(tileView({ status: "empty" }).messageKey, "tile.empty");
  assert.equal(tileView({ status: "restricted" }).messageKey, "tile.restricted");
  assert.equal(tileView({ status: "loading" }).live, "polite");
  assert.equal(tileView({ status: "ready" }).live, "off");
});

test("retry is offered only for an error that can be retried", () => {
  assert.equal(tileView({ status: "error", canRetry: true }).showRetry, true);
  assert.equal(tileView({ status: "error" }).showRetry, false);
  assert.equal(tileView({ status: "empty", canRetry: true }).showRetry, false);
});

test("the footer names the date and the values not verified, only when something is drawn", () => {
  assert.deepEqual(tileView({ status: "ready", asOf: "28 Oct", unverified: 3 }).footer, [{ key: "tile.asOf", asOf: "28 Oct" }, { key: "tile.unverified", count: 3 }]);
  assert.deepEqual(tileView({ status: "ready", unverified: 0 }).footer, []);
  assert.deepEqual(tileView({ status: "ready", unverified: -2.7 }).footer, []);
  assert.deepEqual(tileView({ status: "empty", asOf: "28 Oct", unverified: 3 }).footer, []);
  assert.deepEqual(tileView({ status: "restricted", notFiltered: true }).footer, [{ key: "tile.notFiltered" }]);
});

test("every tile message exists in every language and reads as a sentence, with the right plural forms", () => {
  const keys = new Set<string>();
  for (const status of ["loading", "empty", "error", "restricted"] as const) {
    const v = tileView({ status, canRetry: true });
    if (v.messageKey) keys.add(v.messageKey);
    if (v.hintKey) keys.add(v.hintKey);
  }
  keys.add("tile.retry");
  keys.add("tile.asOf");
  keys.add("tile.menu");
  keys.add("tile.notFiltered");
  for (const locale of LOCALES) {
    const tr = createTranslator(locale, MESSAGES[locale], ENGLISH);
    for (const k of keys) assert.ok(MESSAGES[locale][k], `${locale} ${k}`);
    assert.match(tr.t("tile.asOf", { date: "X" }), /X/);
    assert.match(tr.t("tile.menu", { title: "Water" }), /Water/);
    for (const n of [0, 1, 2, 3, 11, 100]) {
      const s = tr.tp("tile.unverified", n);
      assert.ok(s && !s.includes("tile.unverified"), `${locale} ${n}`);
      if (n >= 3) assert.ok(s.includes(String(n)), `${locale} ${n}: ${s}`);
    }
  }
});
