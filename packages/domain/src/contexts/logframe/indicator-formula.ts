/**
 * Formula indicators (Phase 33.3): an indicator whose value is calculated from other indicators of the same
 * project — a percentage from two counts, a total of several, a difference of two. Nobody types a value for it;
 * it is shown beside the values it came from. Pure: decimal arithmetic only, no clock.
 *
 * Rules:
 * - A term that has no value makes the result "not measured" — never a partial sum, never zero.
 * - A division by zero is "not measured" too, with its reason.
 * - A ratio may be written as a percentage (× 100); the result's type must then be PERCENTAGE or RATIO.
 * - A formula never refers to itself, directly or through other formulas, and only to indicators that exist.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { decimalAdd, decimalDivide, decimalMultiply, decimalSubtract, formatDecimal, parseDecimal, type Decimal } from "../reporting/indicator-calculator.js";
import type { IndicatorType } from "./indicator.js";

export type FormulaOp = "RATIO" | "SUM" | "DIFFERENCE";
export const FORMULA_OPS: readonly FormulaOp[] = ["RATIO", "SUM", "DIFFERENCE"];

export const FORMULA_OP_LABEL: Readonly<Record<FormulaOp, string>> = {
  RATIO: "One divided by another",
  SUM: "The total of several",
  DIFFERENCE: "One minus another",
};

export interface IndicatorFormula {
  op: FormulaOp;
  /** RATIO and DIFFERENCE: exactly two, in order (first ÷ second, first − second). SUM: two or more. */
  terms: string[];
  /** RATIO only: multiply by 100 and read as a percentage. */
  percent?: boolean | undefined;
}

export const FORMULA_MAX_TERMS = 12;

/** The indicators a formula may refer to — deliberately narrow. */
export interface FormulaIndicator {
  id: string;
  code: string;
  type: IndicatorType;
  formula?: IndicatorFormula | undefined;
}

const ADDITIVE: ReadonlySet<IndicatorType> = new Set<IndicatorType>(["NUMBER", "CURRENCY"]);
const RATE_TYPES: ReadonlySet<IndicatorType> = new Set<IndicatorType>(["PERCENTAGE", "RATIO"]);

/** Every indicator id a formula needs, directly. */
export const formulaDependencies = (formula: IndicatorFormula | undefined): string[] => (formula ? [...new Set(formula.terms)] : []);

/**
 * Whether `formula` may be set on indicator `selfId` of type `selfType`, given the project's indicators. The message
 * says what to change.
 */
export function validateFormula(selfId: string, selfType: IndicatorType, formula: IndicatorFormula, indicators: readonly FormulaIndicator[]): Result<IndicatorFormula, DomainError> {
  if (!FORMULA_OPS.includes(formula.op)) return err(DomainError.validation("Choose how the value is calculated", { field: "formula" }));
  const terms = formula.terms.map((t) => t.trim()).filter(Boolean);
  if (terms.length > FORMULA_MAX_TERMS) return err(DomainError.validation(`A formula uses at most ${FORMULA_MAX_TERMS} indicators`, { field: "formula" }));
  if (formula.op !== "SUM" && terms.length !== 2) return err(DomainError.validation(formula.op === "RATIO" ? "A ratio needs two indicators: the one counted and the one it is out of" : "A difference needs two indicators", { field: "formula" }));
  if (formula.op === "SUM" && terms.length < 2) return err(DomainError.validation("A total needs at least two indicators", { field: "formula" }));
  if (new Set(terms).size !== terms.length && formula.op !== "SUM") return err(DomainError.validation("Choose two different indicators", { field: "formula" }));
  const byId = new Map(indicators.map((i) => [i.id, i]));
  for (const t of terms) {
    if (t === selfId) return err(DomainError.validation("An indicator cannot be calculated from itself", { field: "formula" }));
    const found = byId.get(t);
    if (!found) return err(DomainError.validation("A formula can only use indicators of this project", { field: "formula" }));
    if (formula.op !== "RATIO" && !ADDITIVE.has(found.type)) return err(DomainError.validation(`${found.code} is a rate or a percentage; a rate cannot be added or subtracted`, { field: "formula" }));
  }
  if (formula.op === "RATIO") {
    if (formula.percent && !RATE_TYPES.has(selfType)) return err(DomainError.validation("A percentage result needs the indicator's type to be Percentage or Ratio", { field: "formula" }));
    if (!formula.percent && !RATE_TYPES.has(selfType)) return err(DomainError.validation("A ratio result needs the indicator's type to be Percentage or Ratio", { field: "formula" }));
    for (const t of terms) if (RATE_TYPES.has(byId.get(t)!.type)) return err(DomainError.validation(`${byId.get(t)!.code} is already a rate; divide counts, not rates`, { field: "formula" }));
  } else if (!ADDITIVE.has(selfType)) {
    return err(DomainError.validation("A total or a difference gives a count or an amount; set the indicator's type to Number or Currency", { field: "formula" }));
  }
  // No cycle: walk the formulas the terms themselves use; reaching `selfId` again is a loop.
  const seen = new Set<string>();
  const stack = [...terms];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === selfId) return err(DomainError.validation("That would make the indicators calculate each other in a circle", { field: "formula" }));
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...formulaDependencies(byId.get(id)?.formula));
  }
  return ok({ op: formula.op, terms, ...(formula.op === "RATIO" && formula.percent ? { percent: true } : {}) });
}

export type FormulaResult = { value: string } | { value: null; reason: "MISSING_TERM" | "DIVIDE_BY_ZERO" };

const PLACES = 4;

/**
 * Evaluates one formula for one value (a period's value, or the cumulative one). `values` maps indicator id to its
 * recorded text; an absent or non-numeric entry is a missing term. Decimal arithmetic, rounded to four places.
 */
export function evaluateFormula(formula: IndicatorFormula, values: ReadonlyMap<string, string | undefined>): FormulaResult {
  const parts: Decimal[] = [];
  for (const id of formula.terms) {
    const raw = values.get(id);
    const parsed = raw === undefined || raw.trim() === "" ? null : parseDecimal(raw.replace(/,/g, ""));
    if (!parsed) return { value: null, reason: "MISSING_TERM" };
    parts.push(parsed);
  }
  let out: Decimal | null;
  if (formula.op === "SUM") out = parts.reduce((a, b) => decimalAdd(a, b));
  else if (formula.op === "DIFFERENCE") out = decimalSubtract(parts[0]!, parts[1]!);
  else {
    out = decimalDivide(parts[0]!, parts[1]!, PLACES + 2);
    if (!out) return { value: null, reason: "DIVIDE_BY_ZERO" };
    if (formula.percent) out = decimalMultiply(out, parseDecimal("100")!);
  }
  return { value: formatDecimal(out!, PLACES) };
}

/** A plain sentence for the screen: "Calculated: SD-1 ÷ SD-2 × 100". */
export function describeFormula(formula: IndicatorFormula, codeOf: (id: string) => string): string {
  const codes = formula.terms.map(codeOf);
  if (formula.op === "SUM") return `Calculated: ${codes.join(" + ")}`;
  if (formula.op === "DIFFERENCE") return `Calculated: ${codes[0]} − ${codes[1]}`;
  return `Calculated: ${codes[0]} ÷ ${codes[1]}${formula.percent ? " × 100" : ""}`;
}

export function parseFormula(json: string | null | undefined): IndicatorFormula | undefined {
  if (!json) return undefined;
  try {
    const v = JSON.parse(json) as Partial<IndicatorFormula>;
    if (!v || !FORMULA_OPS.includes(v.op as FormulaOp) || !Array.isArray(v.terms)) return undefined;
    return { op: v.op as FormulaOp, terms: v.terms.map(String), ...(v.percent ? { percent: true } : {}) };
  } catch {
    return undefined;
  }
}

export interface FormulaCellInput {
  indicatorId: string;
  periodId: string;
  periodValue: string;
  cumulativeValue: string;
  status: string;
}

export interface DerivedFormulaCell {
  indicatorId: string;
  periodId: string;
  periodValue: string;
  cumulativeValue: string;
  /** VERIFIED only when every value it came from is VERIFIED; otherwise DRAFT. A value that could not be calculated has no cell. */
  status: string;
  calculated: true;
}

/**
 * The calculated cells of a sheet: for each formula indicator and each period in which every term has a recorded
 * cell, the period value and the cumulative value, each worked out separately (a ratio of cumulative values is the
 * cumulative ratio). Formulas that use other formulas are worked out in dependency order. A period where a term has
 * no cell, or a value cannot be worked out (a division by zero), has no cell — never a zero.
 */
export function deriveFormulaCells(indicators: ReadonlyArray<{ id: string; formula?: IndicatorFormula | undefined }>, cells: readonly FormulaCellInput[], periodIds: readonly string[]): DerivedFormulaCell[] {
  const formulas = new Map(indicators.filter((i) => i.formula).map((i) => [i.id, i.formula!]));
  if (formulas.size === 0) return [];
  const have = new Map<string, FormulaCellInput | DerivedFormulaCell>();
  for (const c of cells) have.set(`${c.indicatorId}|${c.periodId}`, c);
  const out: DerivedFormulaCell[] = [];
  let pending = [...formulas.keys()];
  // Depth is bounded by the number of formulas: each pass settles every formula whose terms are all settled.
  for (let pass = 0; pass <= formulas.size && pending.length; pass += 1) {
    const stillWaiting: string[] = [];
    for (const id of pending) {
      const formula = formulas.get(id)!;
      if (formula.terms.some((t) => formulas.has(t) && pending.includes(t) && t !== id)) { stillWaiting.push(id); continue; }
      for (const periodId of periodIds) {
        const parts = formula.terms.map((t) => have.get(`${t}|${periodId}`));
        if (parts.some((p) => !p)) continue;
        const period = evaluateFormula(formula, new Map(formula.terms.map((t, i) => [t, parts[i]!.periodValue])));
        const cumulative = evaluateFormula(formula, new Map(formula.terms.map((t, i) => [t, parts[i]!.cumulativeValue])));
        if (period.value === null && cumulative.value === null) continue;
        const cell: DerivedFormulaCell = {
          indicatorId: id, periodId, periodValue: period.value ?? "", cumulativeValue: cumulative.value ?? "",
          status: parts.every((p) => p!.status === "VERIFIED") ? "VERIFIED" : "DRAFT", calculated: true,
        };
        have.set(`${id}|${periodId}`, cell);
        out.push(cell);
      }
    }
    pending = stillWaiting;
  }
  return out;
}
