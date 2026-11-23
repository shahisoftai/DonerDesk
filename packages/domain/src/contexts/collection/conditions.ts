import { asNumber, blank, isNotApplicable } from "./answer-values.js";
import type { Answers, Condition, ConditionLeaf, ConditionOp, FormProblem } from "./form-model.js";

const OPS: readonly ConditionOp[] = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "FILLED", "EMPTY", "CONTAINS"];

export const isLeaf = (c: Condition): c is ConditionLeaf => "field" in c;

export function referencedFields(c: Condition, out: string[] = []): string[] {
  if (isLeaf(c)) out.push(c.field);
  else for (const child of "all" in c ? c.all : c.any) referencedFields(child, out);
  return out;
}

export function conditionShape(c: Condition, label: string, problems: FormProblem[], field: string): void {
  if (isLeaf(c)) {
    if (!OPS.includes(c.op)) problems.push({ field, message: `${label}: "${String(c.op)}" is not a known comparison.` });
    else if (c.op !== "FILLED" && c.op !== "EMPTY" && c.value === undefined) problems.push({ field, message: `${label}: a comparison needs a value.` });
    else if (c.op === "IN" && !Array.isArray(c.value)) problems.push({ field, message: `${label}: "is one of" needs a list of values.` });
    return;
  }
  const children = "all" in c ? c.all : c.any;
  if (children.length === 0) problems.push({ field, message: `${label}: a group of conditions cannot be empty.` });
  for (const child of children) conditionShape(child, label, problems, field);
}

const comparable = (v: unknown): number | string | null => {
  if (blank(v)) return null;
  if (isNotApplicable(v)) return "n/a";
  const n = asNumber(v);
  if (n !== null) return n;
  // Yes/No answers compare as "yes" / "no" whether they arrive as booleans (the API) or words (a form).
  if (typeof v === "boolean") return v ? "yes" : "no";
  const t = String(v).trim().toLowerCase();
  return t === "true" ? "yes" : t === "false" ? "no" : t;
};

const listOf = (v: unknown): Array<number | string> => (Array.isArray(v) ? v.map(comparable).filter((x): x is number | string => x !== null) : []);

export function conditionHolds(c: Condition, answers: Answers): boolean {
  if (!isLeaf(c)) return "all" in c ? c.all.every((x) => conditionHolds(x, answers)) : c.any.some((x) => conditionHolds(x, answers));
  const raw = answers[c.field];
  if (c.op === "CONTAINS") {
    const want = comparable(c.value as unknown);
    return want !== null && listOf(raw).includes(want);
  }
  const actual = comparable(Array.isArray(raw) ? null : raw);
  if (c.op === "FILLED") return actual !== null || listOf(raw).length > 0;
  if (c.op === "EMPTY") return actual === null && listOf(raw).length === 0;
  const expected = Array.isArray(c.value) ? (c.value as ReadonlyArray<string | number>).map(comparable) : comparable(c.value);
  if (c.op === "NEQ") return actual === null ? true : actual !== expected;
  if (actual === null) return false;
  switch (c.op) {
    case "EQ": return actual === expected;
    case "IN": return Array.isArray(expected) && expected.includes(actual);
    case "GT": case "GTE": case "LT": case "LTE": {
      if (typeof actual !== "number" || typeof expected !== "number") return false;
      return c.op === "GT" ? actual > expected : c.op === "GTE" ? actual >= expected : c.op === "LT" ? actual < expected : actual <= expected;
    }
    default: return false;
  }
}
