import { BALANCE, NOT_MORE_THAN, NOT_NEGATIVE, RANGE, SUM_EQUALS } from "./figure-checks.js";
import { KEY_UNIQUE, PERIOD_READABLE, PLACE_KNOWN, VALUE_READABLE } from "./structural.js";
import type { CheckConfig, CheckDef, CheckInput, Finding } from "./types.js";

/** The checks (§3.5). A new check is a row; `runChecks` is untouched. */
export const CHECK_DEFS: readonly CheckDef[] = [KEY_UNIQUE, PLACE_KNOWN, PERIOD_READABLE, VALUE_READABLE, NOT_NEGATIVE, RANGE, SUM_EQUALS, BALANCE, NOT_MORE_THAN];
const BY_KEY = new Map(CHECK_DEFS.map((c) => [c.key, c]));
export const checkDef = (key: string): CheckDef | undefined => BY_KEY.get(key);

/** The configured checks that cannot run with these columns, as sentences (shown on the Check screen, never silently skipped). */
export function checkConfigProblems(configs: readonly CheckConfig[], columns: CheckInput["columns"]): Array<{ id: string; message: string }> {
  return configs.flatMap((c) => {
    const def = checkDef(c.check);
    if (!def) return [{ id: c.id, message: `'${c.label ?? c.check}' is not a check DonorDesk knows.` }];
    const bad = def.validate(c.params, columns);
    return bad ? [{ id: c.id, message: `${c.label ?? def.label}: ${bad}` }] : [];
  });
}

/**
 * Every always-on check plus the configured ones that fit the columns. Never throws: a check that fails to run is reported as a note.
 * Findings are ordered BLOCK, WARN, NOTE.
 */
export function runChecks(input: CheckInput, configs: readonly CheckConfig[] = []): Finding[] {
  const out: Finding[] = [];
  const plan: Array<{ def: CheckDef; params: Record<string, unknown>; severity: Finding["severity"]; label?: string | undefined }> = [
    ...CHECK_DEFS.filter((d) => d.always).map((def) => ({ def, params: {}, severity: def.defaultSeverity })),
    ...configs.flatMap((c) => {
      const def = checkDef(c.check);
      return def && !def.always && !def.validate(c.params, input.columns) ? [{ def, params: c.params, severity: c.severity ?? def.defaultSeverity, label: c.label }] : [];
    }),
  ];
  for (const { def, params, severity, label } of plan) {
    try {
      for (const f of def.run(input, params)) out.push({ ...f, check: def.key, severity, message: label && !def.always ? `${label}. ${f.message}` : f.message });
    } catch {
      out.push({ check: def.key, severity: "NOTE", rows: [], message: `The check "${label ?? def.label}" could not run on this table.` });
    }
  }
  const rank = { BLOCK: 0, WARN: 1, NOTE: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export const blocks = (findings: readonly Finding[]): boolean => findings.some((f) => f.severity === "BLOCK");

/** Rows with an open warning, for the note under a visual ("Drawn from 1,204 rows; 12 have a data note"). */
export const rowsWithNotes = (findings: readonly Finding[]): Set<number> => new Set(findings.filter((f) => f.severity !== "NOTE").flatMap((f) => f.rows));
