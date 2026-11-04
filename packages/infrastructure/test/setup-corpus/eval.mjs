// `pnpm --filter @donordesk/infrastructure setup:eval` (Phase 36.2, plan §10). Runs every corpus case through the real
// extractors and grounding and prints per-area kept / expected / dropped. Default: recorded replies (deterministic).
// With LLM_PROVIDER set to a real provider (and its key), the same cases run against that model: the numbers to record.
import { SETUP_AREAS, SETUP_AREA_APPLY_ORDER, TenantId, groundAreaPatch, joinBlocks } from "@donordesk/domain";
import { SETUP_EXTRACTION_SPECS, PromptedAreaExtractor, createLLMProvider, TenantSetupLlm } from "../../dist/index.js";
import * as blueWater from "./blue-water.mjs";
import * as cbpfSomalia from "./cbpf-somalia.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TolerantDocumentParser } from "../../dist/parsers/document-parser.js";
import { toSectionBlocks } from "../../dist/project-setup/source-reader.js";

const CASES = [{ name: "blue-water (synthetic)", ...blueWater }];
const live = process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "stub";

function recordedLlm(replies) {
  return {
    available: async () => true,
    completeJson: async ({ user }) => {
      const spec = SETUP_EXTRACTION_SPECS.find((s) => user.startsWith(s.instructions));
      // A refine pass (structure decided over the first answer) has no recorded reply: no answer, the fields stay as read.
      if (!spec) return { ok: true, value: null };
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

// Real documents (live only): parsed with the production parser, read by every area, then judged by the case's checks.
// Run each one RUNS times (default 3) so the variance between runs shows: a check that passes only sometimes is a problem.
const docsDir = process.env.SETUP_EVAL_DOCS_DIR;
const REAL = [{ name: "CBPF Somalia proposal (real)", ...cbpfSomalia }];
if (live && docsDir) {
  const runs = Number(process.env.SETUP_EVAL_RUNS ?? "3") || 3;
  for (const c of REAL) {
    const path = join(docsDir, c.FILE);
    if (!existsSync(path)) { console.log(`\n${c.name}: ${c.FILE} not found in SETUP_EVAL_DOCS_DIR, skipped`); continue; }
    const parsed = await new TolerantDocumentParser().parse({ buffer: readFileSync(path), fileName: c.FILE, fileType: "" });
    const blocks = toSectionBlocks(parsed.text, null).map((b, index) => ({ ...b, documentId: "source-1", index }));
    const sourceText = joinBlocks(blocks);
    const passes = new Map(c.CHECKS.map(([name]) => [name, 0]));
    for (let run = 1; run <= runs; run++) {
      const llm = new TenantSetupLlm(async (_t, model) => createLLMProvider(model ? { model } : undefined));
      const prior = {};
      for (const area of SETUP_AREA_APPLY_ORDER) {
        const spec = SETUP_EXTRACTION_SPECS.find((s) => s.area === area);
        const model = spec.heavy ? process.env.SETUP_HEAVY_MODEL : undefined;
        const ask = model ? { available: llm.available.bind(llm), completeJson: (i) => llm.completeJson({ ...i, model }) } : llm;
        const r = await new PromptedAreaExtractor(spec, ask).extract({ tenantId: T, proposalId: "eval", blocks, sourceText, prior, maxTokens: 8192, timeoutMs: 120_000 });
        if (!r.ok) { console.log(`  run ${run} ${area} FAILED: ${r.error.message}`); continue; }
        const g = groundAreaPatch(area, r.value.fields, sourceText);
        if (!("error" in g)) Object.assign(prior, g.fields);
      }
      for (const [name, check] of c.CHECKS) { let ok = false; try { ok = !!check(prior); } catch { ok = false; } if (ok) passes.set(name, passes.get(name) + 1); }
    }
    console.log(`\n${c.name} — ${runs} run(s), ${process.env.LLM_PROVIDER}${process.env.SETUP_HEAVY_MODEL ? `, heavy areas on ${process.env.SETUP_HEAVY_MODEL}` : ""}`);
    for (const [name, n] of passes) { console.log(`  ${n === runs ? "ok  " : n === 0 ? "FAIL" : "FLAKY"} ${n}/${runs}  ${name}`); if (n < runs) failures += 1; }
  }
  if (failures > 0) process.exitCode = 1;
}
