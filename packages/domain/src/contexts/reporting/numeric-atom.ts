import { parseDecimal, type Decimal } from "./indicator-calculator.js";

/**
 * Semantic role of a numeric atom inside an assertion. A single sentence can
 * carry several numbers with different meanings (achievement vs target vs
 * baseline vs previous period); verification must bind each atom to the right
 * role instead of matching the first number in the sentence.
 */
export type NumericAtomRole =
  | "ACHIEVEMENT"
  | "TARGET"
  | "BASELINE"
  | "COMPARISON"
  | "PERCENT"
  | "CURRENCY"
  | "DATE"
  | "DISAGGREGATION"
  | "OTHER";

export const NUMERIC_ATOM_ROLES: NumericAtomRole[] = [
  "ACHIEVEMENT",
  "TARGET",
  "BASELINE",
  "COMPARISON",
  "PERCENT",
  "CURRENCY",
  "DATE",
  "DISAGGREGATION",
  "OTHER",
];

/**
 * A single numeric atom extracted from an assertion. `value` is the raw text
 * token (for currency/percent it excludes the symbol); the optional binding
 * fields are filled during verification so the same number cannot validate a
 * sentence about the wrong indicator, unit, period, or entity.
 */
export interface NumericAtom {
  /** Offset of the numeric token within the normalized assertion text. */
  charStart: number;
  charEnd: number;
  value: string;
  role: NumericAtomRole;
  unit?: string;
  currency?: string;
  isPercent?: boolean;
  indicatorId?: string;
  indicatorCode?: string;
  reportingPeriodId?: string;
  entity?: string;
  population?: string;
  /** True when this atom has been bound to a verified finding authority. */
  bound: boolean;
}

export interface NumericAtomInput {
  value: string;
  role?: NumericAtomRole;
  unit?: string;
  currency?: string;
  isPercent?: boolean;
  indicatorId?: string;
  indicatorCode?: string;
  reportingPeriodId?: string;
  entity?: string;
  population?: string;
}

export function createNumericAtom(input: NumericAtomInput, offset = 0): NumericAtom {
  const value = input.value.trim();
  const decimal = parseDecimal(value);
  if (decimal === null) throw new Error(`Invalid numeric atom value: ${input.value}`);
  return {
    charStart: offset,
    charEnd: offset + value.length,
    value,
    role: input.role ?? "OTHER",
    unit: input.unit,
    currency: input.currency,
    isPercent: input.isPercent,
    indicatorId: input.indicatorId,
    indicatorCode: input.indicatorCode,
    reportingPeriodId: input.reportingPeriodId,
    entity: input.entity,
    population: input.population,
    bound: false,
  };
}

export function atomDecimal(atom: NumericAtom): Decimal | null {
  return parseDecimal(atom.value);
}

export function atomsEqual(a: NumericAtom, b: NumericAtom): boolean {
  if (a.value !== b.value) return false;
  if (a.role !== b.role) return false;
  if ((a.unit ?? "") !== (b.unit ?? "")) return false;
  if ((a.currency ?? "") !== (b.currency ?? "")) return false;
  if (Boolean(a.isPercent) !== Boolean(b.isPercent)) return false;
  return true;
}

/**
 * Extracts every numeric token from normalized text with its character offset.
 * Uses the same strict decimal parser as the deterministic analyst so no
 * value can slip through with a different number grammar.
 */
export function extractNumericAtoms(text: string): NumericAtom[] {
  const atoms: NumericAtom[] = [];
  const re = /(?:-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  let last = 0;
  let cursor = 0;
  while ((match = re.exec(text)) !== null) {
    const value = match[0];
    if (parseDecimal(value) === null) continue;
    const prefix = text.slice(last, match.index);
    cursor += prefix.length;
    atoms.push({
      charStart: cursor,
      charEnd: cursor + value.length,
      value,
      role: "OTHER",
      bound: false,
    });
    cursor += value.length;
    last = match.index + value.length;
  }
  return atoms;
}

/**
 * Groups a raw token list with coarse roles inferred from surrounding text.
 * Deterministic heuristics only; the structured verifier later binds atoms to
 * findings. This helper is intentionally conservative: anything it cannot
 * classify stays OTHER.
 */
export function classifyNumericAtomRoles(
  text: string,
  atoms: NumericAtom[],
): NumericAtom[] {
  const lower = text.toLowerCase();
  const hasTarget = /target|planned|goal|expected/i.test(lower);
  const hasBaseline = /baseline|initial|at (the )?start/i.test(lower);
  const hasPercent = /percent|%|rate/i.test(lower);
  const hasCurrency = /\b(usd|eur|gbp|kes|uzs|afn|npr|rwh|rwf|pkr)\b|\$|€|£/i.test(lower);
  const hasPrevious = /previous|prior|last (month|quarter|year|period)|compared to|vs\.?/i.test(lower);

  return atoms.map((atom, index) => {
    const role: NumericAtomRole = "OTHER";
    const copy: NumericAtom = { ...atom, role };
    if (hasPercent && index === atoms.length - 1 && /percent|rate/i.test(lower.slice(atom.charEnd - 8, atom.charEnd + 12))) {
      copy.role = "PERCENT";
      copy.isPercent = true;
    }
    if (hasCurrency) copy.role = "CURRENCY";
    if (hasTarget && index === 1) copy.role = "TARGET";
    if (hasBaseline && index === 2) copy.role = "BASELINE";
    if (hasPrevious) copy.role = "COMPARISON";
    return copy;
  });
}
