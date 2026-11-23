import { asNumber, blank, isNotApplicable } from "./answer-values.js";
import { FORM_LIMITS } from "./form-limits.js";

/**
 * Calculated answers (Phase 62.6): a small arithmetic language over the form's own fields, so a bed occupancy or a budget share is
 * worked out where the form is filled and again on the server. Numbers, `+ - * /`, parentheses, a field key, a path into a grid or
 * repeat (`wards.*.beds`) and the functions `sum`, `avg`, `min`, `max` and `count` over such a path. A term that is missing makes the
 * result missing (never 0), and a division by zero is missing too. Pure; no `eval`.
 */
export type Expr =
  | { t: "num"; v: number }
  | { t: "ref"; path: string }
  | { t: "neg"; a: Expr }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Expr; b: Expr }
  | { t: "fn"; name: FormulaFn; path: string };

export type FormulaFn = "sum" | "avg" | "min" | "max" | "count";
const FUNCTIONS: readonly string[] = ["sum", "avg", "min", "max", "count"];

type Token = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

function tokenize(text: string): Token[] | string {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(\.\d+)?/.exec(text.slice(i));
    if (num) { out.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[a-z][a-z0-9_]*(\.(\*|[a-z0-9_]+))*/.exec(text.slice(i));
    if (id) { out.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    if ("+-*/(),".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    return `"${c}" is not allowed in a formula.`;
  }
  return out;
}

export type ParsedFormula = { ok: true; expr: Expr; refs: string[] } | { ok: false; reason: string };

export function parseFormFormula(text: string): ParsedFormula {
  if (text.trim() === "") return { ok: false, reason: "The formula is empty." };
  if (text.length > FORM_LIMITS.formulaLength) return { ok: false, reason: `The formula is longer than ${FORM_LIMITS.formulaLength} characters.` };
  const tokens = tokenize(text);
  if (typeof tokens === "string") return { ok: false, reason: tokens };
  let pos = 0;
  const refs: string[] = [];
  const fail = (reason: string): never => { throw new Error(reason); };
  const peek = (): Token | undefined => tokens[pos];
  const eat = (v: string): boolean => { const t = peek(); if (t?.k === "op" && t.v === v) { pos++; return true; } return false; };

  function primary(): Expr {
    const t = peek();
    if (!t) return fail("The formula ends too soon.");
    if (t.k === "num") { pos++; return { t: "num", v: t.v }; }
    if (t.k === "id") {
      pos++;
      if (eat("(")) {
        if (!FUNCTIONS.includes(t.v)) return fail(`"${t.v}" is not a function (use sum, avg, min, max or count).`);
        const arg = peek();
        if (arg?.k !== "id") return fail(`${t.v}( needs a field or a path such as wards.*.beds.`);
        pos++;
        if (!eat(")")) return fail(`${t.v}( is not closed.`);
        refs.push(arg.v);
        return { t: "fn", name: t.v as FormulaFn, path: arg.v };
      }
      refs.push(t.v);
      return { t: "ref", path: t.v };
    }
    if (eat("(")) { const e = sum(); if (!eat(")")) return fail("A bracket is not closed."); return e; }
    if (eat("-")) return { t: "neg", a: primary() };
    return fail(`"${t.v}" is not expected here.`);
  }
  function product(): Expr {
    let a = primary();
    for (;;) {
      if (eat("*")) a = { t: "bin", op: "*", a, b: primary() };
      else if (eat("/")) a = { t: "bin", op: "/", a, b: primary() };
      else return a;
    }
  }
  function sum(): Expr {
    let a = product();
    for (;;) {
      if (eat("+")) a = { t: "bin", op: "+", a, b: product() };
      else if (eat("-")) a = { t: "bin", op: "-", a, b: product() };
      else return a;
    }
  }
  try {
    const expr = sum();
    if (pos < tokens.length) return { ok: false, reason: `"${(tokens[pos] as { v: unknown }).v}" is not expected here.` };
    return { ok: true, expr, refs };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** The answers a path names, as the evaluator needs them. */
export type PathReader = (path: string) => unknown[];

const numbersOf = (values: unknown[]): number[] => values.filter((v) => !blank(v) && !isNotApplicable(v)).map(asNumber).filter((n): n is number => n !== null);

export function evaluateFormFormula(expr: Expr, read: PathReader): number | null {
  switch (expr.t) {
    case "num": return expr.v;
    case "neg": { const a = evaluateFormFormula(expr.a, read); return a === null ? null : -a; }
    case "ref": { const v = read(expr.path); return v.length === 1 ? numbersOf(v)[0] ?? null : null; }
    case "fn": {
      const values = read(expr.path);
      if (expr.name === "count") return values.filter((v) => !blank(v) && !isNotApplicable(v)).length;
      const n = numbersOf(values);
      if (n.length === 0) return null;
      return expr.name === "sum" ? n.reduce((s, x) => s + x, 0) : expr.name === "avg" ? n.reduce((s, x) => s + x, 0) / n.length : expr.name === "min" ? Math.min(...n) : Math.max(...n);
    }
    case "bin": {
      const a = evaluateFormFormula(expr.a, read);
      const b = evaluateFormFormula(expr.b, read);
      if (a === null || b === null) return null;
      if (expr.op === "+") return a + b;
      if (expr.op === "-") return a - b;
      if (expr.op === "*") return a * b;
      return b === 0 ? null : a / b;
    }
  }
}

export const roundTo = (n: number, decimals: number): number => {
  const f = 10 ** Math.min(Math.max(decimals, 0), 10);
  return Math.round(n * f) / f;
};
