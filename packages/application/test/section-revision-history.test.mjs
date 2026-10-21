import test from "node:test";
import assert from "node:assert/strict";
import { ListSectionRevisionsHandler } from "../dist/index.js";

const rev = (n, content, extra = {}) => ({ id: `r${n}`, revisionNumber: n, changeOrigin: n === 1 ? "GENERATION" : "MANUAL_EDIT", createdAt: new Date("2026-10-21T10:00:00Z"), content, ...extra });

test("each version says which model wrote it and what changed since the one before", async () => {
  const handler = new ListSectionRevisionsHandler(
    { findById: async () => ({ ok: true, value: { id: "s", currentRevisionId: "r2" } }) },
    { findBySection: async () => ({ ok: true, value: [rev(1, "We drilled 40 wells.", { modelId: "glm-5.3-flash", promptVersion: 6 }), rev(2, "We drilled 42 wells in total.")] }) },
  );
  const r = await handler.handle({ tenant: { tenantId: { toString: () => "t" } } }, "s");
  assert.equal(r.ok, true);
  const [newest, oldest] = r.value.items;
  assert.equal(newest.modelId, null);
  assert.match(newest.changeSummary, /figures added: 42; figures removed: 40/);
  assert.equal(oldest.modelId, "glm-5.3-flash");
  assert.equal(oldest.promptVersion, 6);
  assert.equal(oldest.changeSummary, null);
});
