// Generates the Python strategy module consumed by the DonorDesk workers from
// the single source of truth: packages/contracts/src/strategies/heuristic-rules.json.
// Regenerate after editing the JSON:
//   pnpm --filter @donordesk/contracts generate:workers
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(here, "../src/strategies/heuristic-rules.json");
const outPath = resolve(here, "../../../apps/workers/app/_strategy_data.py");

const rules = JSON.parse(readFileSync(jsonPath, "utf8"));

function pyRepr(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

const lines = [];
lines.push("# GENERATED FILE - do not edit by hand.");
lines.push("# Source: packages/contracts/src/strategies/heuristic-rules.json");
lines.push("# Regenerate with: pnpm --filter @donordesk/contracts generate:workers");
lines.push("");
lines.push("from typing import Any");
lines.push("");
lines.push(`EVIDENCE_KEYWORDS: list[dict[str, Any]] = ${pyRepr(rules.evidenceKeywords)}`);
lines.push("");
lines.push(`SENSITIVE_KEYWORDS: list[str] = ${pyRepr(rules.sensitiveKeywords)}`);
lines.push("");
lines.push(`ACTIVITY_TITLE_MATCH_PREFIX: int = ${JSON.stringify(rules.activityTitleMatchPrefix)}`);
lines.push(`INDICATOR_NAME_MATCH_PREFIX: int = ${JSON.stringify(rules.indicatorNameMatchPrefix)}`);
lines.push("");
lines.push(`PARSE_ROUTES: list[dict[str, Any]] = ${pyRepr(rules.parseRoutes)}`);
lines.push("");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n"));
console.log(`Wrote ${outPath}`);
