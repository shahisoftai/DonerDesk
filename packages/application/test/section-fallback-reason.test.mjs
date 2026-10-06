import assert from "node:assert/strict";
import test from "node:test";
import { ReportRevisionService } from "../dist/index.js";
import { ReportSection } from "@donordesk/domain";

const tenantId = { toString: () => "t1" };
const ok = (value) => ({ ok: true, value });

function service() {
  const saved = [];
  const revisions = { createNextForSection: async (i) => ok({ id: `rev-${saved.length + 1}`, ...i }) };
  const sections = { update: async (s) => { saved.push({ fallback: s.generationFallback }); return ok(s); } };
  return { saved, svc: new ReportRevisionService(revisions, sections, { normalizeAndHash: (t) => t }) };
}
const newSection = () => ReportSection.create({ id: "s", tenantId: "t1", reportDraftId: "d", sectionTitle: "Progress", sectionOrder: 1 });
const commit = (svc, section, extra = {}) =>
  svc.commitChange({ tenantId, section, content: "text", sourceReferences: [], unsupportedClaims: [], changeOrigin: "GENERATION", actorId: "u", ...extra });

test("a stub section stores why; the next AI or manual write clears it (25.1)", async () => {
  const { svc, saved } = service();
  const section = newSection();
  await commit(svc, section, { generationFallback: { reason: "VALIDATOR_FAILED", detail: "figure not in your data: 33.3" } });
  assert.deepEqual(saved[0].fallback, { reason: "VALIDATOR_FAILED", detail: "figure not in your data: 33.3" });
  await commit(svc, section, { changeOrigin: "REGENERATION" });
  assert.equal(saved[1].fallback, undefined, "an AI-written regeneration clears it");
  await commit(svc, section, { generationFallback: { reason: "PROVIDER_TIMEOUT" } });
  await commit(svc, section, { changeOrigin: "MANUAL_EDIT" });
  assert.equal(saved[3].fallback, undefined, "a manual edit clears it");
});
