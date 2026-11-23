import { asNumber, blank } from "./answer-values.js";
import type { ConstraintKind, FormConstraint, FormProblem } from "./form-model.js";

/**
 * Rules that compare several answers (Phase 62.6): functional beds cannot exceed sanctioned beds, the sources add up to the budget, one
 * of several contacts is given. One row per kind: `holds` answers `true` when the rule is satisfied or cannot be judged yet (a missing
 * answer is never a violation of a comparison; a required answer is the field's own rule).
 */
interface ConstraintDef {
  /** Fields the kind needs at least. */
  readonly minFields: number;
  readonly sentence: (labels: string[]) => string;
  holds(values: ReadonlyArray<unknown>): boolean;
}

const nums = (values: ReadonlyArray<unknown>): Array<number | null> => values.map((v) => (blank(v) ? null : asNumber(v)));

export const CONSTRAINT_DEFS: Readonly<Record<ConstraintKind, ConstraintDef>> = {
  LTE: { minFields: 2, sentence: (l) => `${l[0]} cannot be more than ${l[1]}.`, holds: (v) => { const [a, b] = nums(v); return a == null || b == null || a <= b; } },
  GTE: { minFields: 2, sentence: (l) => `${l[0]} cannot be less than ${l[1]}.`, holds: (v) => { const [a, b] = nums(v); return a == null || b == null || a >= b; } },
  SUM_EQUALS: {
    minFields: 3,
    sentence: (l) => `${l.slice(1).join(" + ")} must add up to ${l[0]}.`,
    holds: (v) => {
      const [total, ...parts] = nums(v);
      if (total == null || parts.some((p) => p === null)) return true;
      return Math.abs((parts as number[]).reduce((s, p) => s + p, 0) - total) < 1e-6;
    },
  },
  ONE_OF_REQUIRED: { minFields: 2, sentence: (labels) => `Give at least one of: ${labels.join(", ")}.`, holds: (v) => v.some((x) => !blank(x)) },
};

export const CONSTRAINT_KINDS = Object.keys(CONSTRAINT_DEFS) as ConstraintKind[];

export function constraintDefinitionProblems(constraints: ReadonlyArray<FormConstraint>, keys: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const c of constraints) {
    const def = CONSTRAINT_DEFS[c.kind];
    if (!def) { out.push(`"${String(c.kind)}" is not a kind of rule.`); continue; }
    if (c.fields.length < def.minFields) out.push(`A ${c.kind} rule needs at least ${def.minFields} fields.`);
    for (const f of c.fields) if (!keys.has(f)) out.push(`A rule names "${f}", which is not a field of the form.`);
  }
  return out;
}

/** Checks the rules against the kept answers. A rule whose fields are not all asked is not judged. */
export function checkConstraints(constraints: ReadonlyArray<FormConstraint>, values: Readonly<Record<string, unknown>>, labels: Readonly<Record<string, string>>, asked: ReadonlySet<string>): FormProblem[] {
  const problems: FormProblem[] = [];
  for (const c of constraints) {
    const def = CONSTRAINT_DEFS[c.kind];
    if (!def || !c.fields.every((f) => asked.has(f))) continue;
    if (def.holds(c.fields.map((f) => values[f]))) continue;
    const names = c.fields.map((f) => labels[f] ?? f);
    problems.push({ field: c.fields[0]!, message: c.message?.trim() || def.sentence(names), code: "CONSTRAINT", params: { kind: c.kind, fields: c.fields.join(",") } });
  }
  return problems;
}
