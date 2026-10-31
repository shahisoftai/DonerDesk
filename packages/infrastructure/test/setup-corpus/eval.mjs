// `pnpm --filter @donordesk/infrastructure setup:eval` (Phase 36.2, plan §10). Runs every corpus case through the real
// extractors and grounding and prints per-area kept / expected / dropped. Default: recorded replies (deterministic).
// With LLM_PROVIDER set to a real provider (and its key), the same cases run against that model: the numbers to record.
import { SETUP_AREAS, SETUP_AREA_APPLY_ORDER, TenantId, groundAreaPatch, joinBlocks } from "@donordesk/domain";
import { SETUP_EXTRACTION_SPECS, PromptedAreaExtractor, createLLMProvider, TenantSetupLlm } from "../../dist/index.js";
import * as blueWater from "./blue-water.mjs";

const CASES = [{ name: "blue-water (synthetic)", ...blueWater }];
const live = process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "stub";

function recordedLlm(replies) {
  return {
    available: async () => true,
    completeJson: async ({ user }) => {
      const spec = SETUP_EXTRACTION_SPECS.find((s) => user.startsWith(s.instructions));
      return { ok: true, value: { text: JSON.stringify(replies[spec.area] ?? {}), model: "recorded", promptVersion: spec.promptVersion } };
    },
  };
}

const T = TenantId.create("tenant-eval");
let failures = 0;
for (const c of CASES) {
  const llm = live ? new TenantSetupLlm(async () => createLLMProvider()) : recordedLlm(c.REPLIES);
  const sourceText = joinBlocks(c.BLOCKS);
  const prior = {};
  console.log(`\n${c.name} — ${live ? `live (${process.env.LLM_PROVIDER})` : "recorded replies"}`);
  for (const area of SETUP_AREA_APPLY_ORDER) {
    const spec = SETUP_EXTRACTION_SPECS.find((s) => s.area === area);
    const started = Date.now();
    const r = await new PromptedAreaExtractor(spec, llm).extract({ tenantId: T, proposalId: "eval", blocks: c.BLOCKS, sourceText, prior, maxTokens: 8192, timeoutMs: 120_000 });
    if (!r.ok) { failures += 1; console.log(`  ${area.padEnd(15)} FAILED: ${r.error.message}`); continue; }
    const g = groundAreaPatch(area, r.value.fields, sourceText);
    if ("error" in g) { failures += 1; console.log(`  ${area.padEnd(15)} FAILED: ${g.error}`); continue; }
    Object.assign(prior, g.fields);
    for (const field of SETUP_AREAS[area].fields) {
      const kept = Array.isArray(g.fields[field]) ? g.fields[field].length : Object.values(g.fields[field] ?? {}).filter((i) => i.value !== null).length;
      const expected = field === "facts" ? c.EXPECTED.factsStated : c.EXPECTED[field];
      if (!live && kept !== expected) failures += 1;
      console.log(`  ${field.padEnd(15)} kept ${kept} / expected ${expected}, dropped ${g.dropped} of ${g.checked}, ${Date.now() - started} ms`);
    }
  }
}
if (failures > 0) { console.log(`\n${failures} problem(s).`); process.exitCode = 1; }
