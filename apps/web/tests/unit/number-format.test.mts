import assert from "node:assert/strict";
import test from "node:test";
import { formatChangeAmount, formatFullNumber, formatTileNumber } from "../../src/features/design/domain/number-format.ts";

test("figures are written in full up to a million, compact above", () => {
  assert.equal(formatTileNumber(12400, "en"), "12,400");
  assert.equal(formatTileNumber(1_250_000, "en"), "1.3M");
  assert.equal(formatFullNumber(1_250_000, "en"), "1,250,000");
});
test("Arabic keeps Latin digits and a change is written without its sign", () => {
  assert.match(formatTileNumber(1234, "ar"), /^[0-9٬,.\s]+$/);
  assert.doesNotMatch(formatTileNumber(1234, "ar"), /[٠-٩]/);
  assert.equal(formatChangeAmount(-12, "en"), "12");
});
