import test from "node:test";
import assert from "node:assert/strict";
import { adaptationProblem, adaptationsInRange, adaptationSentence } from "../dist/index.js";

const ok = { recordedOn: "2026-03-02", whatChanged: "Moved borehole drilling to the dry season", why: "Roads were flooded" };

test("a complete adaptation has no problem; each missing piece is named", () => {
  assert.equal(adaptationProblem(ok), null);
  assert.match(adaptationProblem({ ...ok, whatChanged: "  " }), /what changed/i);
  assert.match(adaptationProblem({ ...ok, why: "" }), /why/i);
  assert.match(adaptationProblem({ ...ok, recordedOn: "2026-13-40" }), /day/i);
  assert.match(adaptationProblem({ ...ok, recordedOn: "03/02/2026" }), /day/i);
  assert.match(adaptationProblem({ ...ok, why: "x".repeat(1001) }), /too long/);
});

test("the effect on results is optional but counted in the length rule", () => {
  assert.equal(adaptationProblem({ ...ok, effectOnResults: "Three wells slip to next quarter" }), null);
  assert.match(adaptationProblem({ ...ok, effectOnResults: "x".repeat(1001) }), /effect/i);
});

test("adaptations in a period are the ones dated inside it, newest first", () => {
  const list = [{ recordedOn: "2026-02-28" }, { recordedOn: "2026-03-10" }, { recordedOn: "2026-03-31" }, { recordedOn: "2026-04-01" }];
  assert.deepEqual(adaptationsInRange(list, "2026-03-01", "2026-03-31").map((a) => a.recordedOn), ["2026-03-31", "2026-03-10"]);
});

test("the sentence says what, why and the effect, once each", () => {
  assert.equal(adaptationSentence({ ...ok, effectOnResults: "Three wells slip to next quarter." }), "On 2026-03-02: Moved borehole drilling to the dry season. The reason: Roads were flooded. Effect on results: Three wells slip to next quarter.");
  assert.equal(adaptationSentence(ok), "On 2026-03-02: Moved borehole drilling to the dry season. The reason: Roads were flooded.");
});
