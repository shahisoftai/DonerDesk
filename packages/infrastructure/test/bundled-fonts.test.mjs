import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { BUNDLED_FONTS } from "@donordesk/domain";
import { EXTRA_FONTS, FONT_DIR, extraFontFor, firstFamily } from "../dist/infographics/bundled-fonts.js";

test("the fonts the editor says are bundled are exactly the ones shipped, each with its files and licence", () => {
  const shipped = new Set(["liberation-sans", "noto-sans-arabic", ...EXTRA_FONTS.map((f) => f.id)]);
  assert.deepEqual(new Set(BUNDLED_FONTS.map((f) => f.id)), shipped);
  const files = new Set(readdirSync(FONT_DIR));
  for (const f of EXTRA_FONTS) {
    assert.ok(existsSync(`${FONT_DIR}${f.regular}`) && existsSync(`${FONT_DIR}${f.bold}`), `${f.id} files`);
    assert.ok([...files].some((n) => n.startsWith("LICENSE-") && n.toLowerCase().includes(f.regular.split("-")[0].toLowerCase())), `${f.id} licence`);
  }
});

test("a family is found from a CSS stack by its first name only", () => {
  assert.equal(firstFamily(`"PT Sans", system-ui, sans-serif`), "PT Sans");
  assert.equal(extraFontFor(`'Lato', Arial`)?.id, "lato");
  assert.equal(extraFontFor(`Arial, Lato`), undefined, "only the first family decides");
  assert.equal(extraFontFor(`"Liberation Sans", Arial, sans-serif`), undefined);
});
