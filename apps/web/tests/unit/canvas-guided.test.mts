import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_CANVAS_TEMPLATES } from "@donordesk/domain/contexts/canvas/index.js";
import { GOALS, suggestRoles } from "../../src/features/canvas/domain/guided.ts";

test("every goal points at a starter that exists, and no goal is repeated", () => {
  const ids = new Set(BUILT_IN_CANVAS_TEMPLATES.map((t) => t.id));
  for (const g of GOALS) assert.ok(ids.has(g.templateId), `${g.key} -> ${g.templateId}`);
  assert.equal(new Set(GOALS.map((g) => g.key)).size, GOALS.length);
});

test("a role gets an indicator only when they share a word, and one indicator is never used twice", () => {
  const indicators = [{ id: "i1", code: "A", name: "Teachers trained in inclusive teaching" }, { id: "i2", code: "B", name: "Children enrolled in school" }];
  const roles = [{ key: "r1", label: "Teachers trained" }, { key: "r2", label: "Children in school" }, { key: "r3", label: "Water points built" }];
  assert.deepEqual(suggestRoles(roles, indicators), { r1: "i1", r2: "i2" });
  assert.deepEqual(suggestRoles([{ key: "x", label: "Teachers trained" }, { key: "y", label: "Teachers trained" }], indicators), { x: "i1" });
});
