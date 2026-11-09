import { resolveFieldRef } from "./catalogue.js";

/**
 * A figure worked out from other figures of the same question (a ratio, a total, a difference, a share). It is part of the visual,
 * never stored back as data. The rules are the formula indicators': counts and amounts only (a rate is never added, subtracted or
 * divided), like with like, and a missing term or a zero divisor gives "not measured", never a partial sum or 0.
 */
export const CALCULATED_OPS = ["RATIO", "SUM", "DIFFERENCE", "SHARE"] as const;
export type CalculatedOp = (typeof CALCULATED_OPS)[number];

export interface CalculatedField {
  id: string;
  label: string;
  op: CalculatedOp;
  /** Measure references from the query: two for RATIO, DIFFERENCE and SHARE (part, whole), two or more for SUM. */
  terms: string[];
  /** RATIO and SHARE: express as a percentage. */
  percent?: boolean | undefined;
}

export interface CalculatedProblem { path: string; message: string }
const MAX_TERMS = 8;

export function calculatedProblems(fields: readonly CalculatedField[], measures: readonly string[], source: string): CalculatedProblem[] {
  const out: CalculatedProblem[] = [];
  const ids = new Set<string>();
  fields.forEach((f, i) => {
    const at = `calculated.${i}`;
    if (!f.id.trim() || ids.has(f.id)) out.push({ path: at, message: "Each calculated figure needs its own name." });
    ids.add(f.id);
    const needsTwo = f.op !== "SUM";
    if (needsTwo ? f.terms.length !== 2 : f.terms.length < 2 || f.terms.length > MAX_TERMS) {
      out.push({ path: at, message: needsTwo ? "This calculation needs exactly two figures." : `A total needs between 2 and ${MAX_TERMS} figures.` });
      return;
    }
    const kinds = new Set<string>();
    for (const t of f.terms) {
      const hit = resolveFieldRef(t, source);
      if (!hit || !measures.includes(t)) { out.push({ path: at, message: `"${t}" must be one of the figures chosen for this visual.` }); continue; }
      if (hit.field.type === "RATE") out.push({ path: at, message: `${hit.field.label} is a rate: rates are never added, subtracted or divided.` });
      kinds.add(hit.field.money ? "AMOUNT" : hit.field.type);
    }
    if (kinds.size > 1) out.push({ path: at, message: "A calculation compares like with like: amounts with amounts, counts with counts." });
  });
  return out;
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** A missing term or a zero divisor is "not measured" (null); the result is never 0 by default and never partial. */
export function evaluateCalculated(f: CalculatedField, values: Readonly<Record<string, number | null | undefined>>): number | null {
  const v = f.terms.map((t) => values[t]);
  if (v.some((x) => x === null || x === undefined || !Number.isFinite(x))) return null;
  const n = v as number[];
  switch (f.op) {
    case "SUM": return round(n.reduce((a, b) => a + b, 0));
    case "DIFFERENCE": return round(n[0]! - n[1]!);
    case "RATIO":
    case "SHARE": {
      if (n[1] === 0) return null;
      const r = n[0]! / n[1]!;
      return round(f.percent ? r * 100 : r);
    }
  }
}
