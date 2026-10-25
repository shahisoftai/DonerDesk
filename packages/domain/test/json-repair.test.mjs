import test from "node:test";
import assert from "node:assert/strict";
import { tryParseJson, completeTruncatedJson, repairUnescapedControlChars } from "../dist/index.js";

test("tryParseJson parses well-formed JSON directly", () => {
  assert.deepEqual(tryParseJson('{"a":1,"b":["x","y"]}'), { a: 1, b: ["x", "y"] });
});

test("tryParseJson repairs a reply truncated mid-array with no closing brace at all", () => {
  // A reasoning model's output budget ran out after the second string; nothing after it exists.
  const truncated = '{"headlines":["21,345 people reached in Uganda"],"messages":["14 of 18 activities are done';
  const out = tryParseJson(truncated);
  assert.deepEqual(out, { headlines: ["21,345 people reached in Uganda"], messages: ["14 of 18 activities are done"] });
});

test("tryParseJson repairs a reply truncated mid-string with an unclosed object and array", () => {
  const truncated = '{"headlines":["Clean water reached 1,2';
  const out = tryParseJson(truncated);
  assert.deepEqual(out, { headlines: ["Clean water reached 1,2"] });
});

test("tryParseJson repairs a literal control character inside a string value", () => {
  const withRawNewline = '{"messages":["Line one\nLine two"]}';
  const out = tryParseJson(withRawNewline);
  assert.deepEqual(out, { messages: ["Line one\nLine two"] });
});

test("tryParseJson returns undefined for text that is not JSON at all", () => {
  assert.equal(tryParseJson("I cannot help with that."), undefined);
  assert.equal(tryParseJson(""), undefined);
});

test("completeTruncatedJson returns null when nothing needs closing", () => {
  assert.equal(completeTruncatedJson('{"a":1}'), null);
  assert.equal(completeTruncatedJson(""), null);
});

test("repairUnescapedControlChars leaves already-valid JSON unchanged", () => {
  const valid = '{"a":"b\\nc"}';
  assert.equal(repairUnescapedControlChars(valid), valid);
});
