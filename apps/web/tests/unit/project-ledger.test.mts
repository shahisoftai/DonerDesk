import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { PROJECT_STAGES } from "../../src/features/projects/domain/project-stages.ts";
import { OVERVIEW_SECTION_ORDER } from "../../src/features/projects/domain/overview-sections.ts";
import { PROJECT_COMMANDS } from "../../src/features/command/domain/commands.ts";
import { RECORD_KINDS } from "../../src/features/record/domain/record-kinds.ts";
import { SETUP_REQUIREMENTS } from "@donordesk/domain";

/**
 * Phase 65 gate: no feature is lost. Every project route, stage page, Overview panel, project command, Record kind and wizard
 * requirement has a row in `memorybank/imp/phase65-ledger.md`, and the ledger names nothing that no longer exists. Adding a page, panel,
 * command, kind or requirement without a row fails here; so does leaving a row behind after removing one.
 */
const WEB = process.cwd();
const ROOT = join(WEB, "..", "..");
const ledger = readFileSync(join(ROOT, "memorybank/imp/phase65-ledger.md"), "utf8");
const rows = ledger.split("\n").filter((l) => /^\| (route|stage-page|panel|command|record-kind|requirement) \|/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim().replace(/`/g, "")));
const of = (kind: string) => new Set(rows.filter((r) => r[0] === kind).map((r) => r[1]!));

const PROJECT_APP = join(WEB, "src", "app", "(portal)", "projects", "[id]");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? files(f) : /^(page\.tsx|route\.ts)$/.test(n) ? [f] : []; });
}
const routes = files(PROJECT_APP).map((f) => { const sub = "/" + relative(PROJECT_APP, f).split(sep).slice(0, -1).join("/"); return sub === "/" ? "(home)" : sub; });

function same(kind: string, actual: readonly string[]) {
  const have = of(kind);
  assert.deepEqual(actual.filter((a) => !have.has(a)), [], `${kind}: add these to phase65-ledger.md`);
  assert.deepEqual([...have].filter((h) => !actual.includes(h)), [], `${kind}: the ledger names things that no longer exist`);
}

test("ledger: every project route has a row", () => same("route", routes));
test("ledger: every page of every stage has a row", () => same("stage-page", PROJECT_STAGES.flatMap((s) => s.pages.map((p) => (p.path === "" ? "(home)" : p.path)))));
test("ledger: every Overview panel has a row", () => same("panel", [...OVERVIEW_SECTION_ORDER]));
test("ledger: every project command has a row", () => same("command", PROJECT_COMMANDS.map((c) => c.id)));
test("ledger: every Record kind has a row", () => same("record-kind", RECORD_KINDS.map((k) => k.key)));
test("ledger: every wizard requirement has a row, and its timing is the rule's own", () => {
  same("requirement", SETUP_REQUIREMENTS.map((r) => r.key));
  for (const r of SETUP_REQUIREMENTS) {
    const row = rows.find((x) => x[0] === "requirement" && x[1] === r.key)!;
    assert.equal(row[3]!.startsWith("After launch"), r.when === "AFTER_LAUNCH", r.key);
  }
});
