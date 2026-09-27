import { classifyNumericAtomRoles, extractNumericAtoms, type NumericAtom } from "./numeric-atom.js";
import { decimalCompare, formatDecimal, parseDecimal, type Decimal } from "./indicator-calculator.js";
import type { VerifiedFinding } from "./verified-finding.js";

/**
 * A one-click correction for a statement whose number does not match the
 * evidence: replace `from` (the token exactly as written in the statement)
 * with `to` (formatted in the same style), citing the evidence that holds it.
 */
export interface NumericReplacement {
  from: string;
  to: string;
  evidenceId: string;
}

export interface NumericReplacementInput {
  claimText: string;
  verificationResult: string;
  verificationReasonCode?: string;
  sources: ReadonlyArray<{ evidenceId: string; sourceText: string }>;
  findings: ReadonlyArray<Pick<VerifiedFinding, "value" | "cumulativeValue">>;
}

const NON_ACHIEVEMENT = new Set(["DATE", "COUNT"]);

function isPercentAt(text: string, atom: NumericAtom): boolean {
  return /^\s?%/.test(text.slice(atom.charEnd, atom.charEnd + 2));
}

function findingDecimals(findings: NumericReplacementInput["findings"]): Decimal[] {
  const out: Decimal[] = [];
  for (const f of findings) {
    for (const text of [f.value, f.cumulativeValue]) {
      const parsed = text === undefined ? null : parseDecimal(text);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

const includesDecimal = (list: Decimal[], value: Decimal) => list.some((d) => decimalCompare(d, value) === 0);

/** Formats `value` the way `sample` is written (thousands separators or not). */
export function formatLike(sample: string, value: Decimal): string {
  const plain = formatDecimal(value);
  if (!sample.includes(",")) return plain;
  const [int = "", frac] = plain.replace(/^-/, "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${plain.startsWith("-") ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/**
 * Suggests a replacement number for a failed numeric statement — only when it
 * is unambiguous. All of these must hold, otherwise `null`:
 *   - the statement failed with VALUE_MISMATCH;
 *   - exactly one achievement number in it matches no verified finding;
 *   - across the evidence the statement cites, exactly one distinct number of
 *     the same kind (percent or not) is also a verified finding value.
 * The replacement therefore always comes from the evidence and re-verifies
 * against the verified findings (grounding rule: never invent a number).
 * Pure and deterministic.
 */
export function suggestNumericReplacement(input: NumericReplacementInput): NumericReplacement | null {
  if (input.verificationResult !== "FAILED" || input.verificationReasonCode !== "VALUE_MISMATCH") return null;
  const verified = findingDecimals(input.findings);
  if (verified.length === 0) return null;

  const atoms = classifyNumericAtomRoles(input.claimText, extractNumericAtoms(input.claimText)).filter((a) => !NON_ACHIEVEMENT.has(a.role));
  const wrong = atoms.filter((a) => {
    const value = parseDecimal(a.value);
    return value !== null && !includesDecimal(verified, value);
  });
  if (wrong.length !== 1) return null;
  const target = wrong[0]!;
  const targetValue = parseDecimal(target.value)!;
  const targetPercent = isPercentAt(input.claimText, target);

  const candidates = new Map<string, { value: Decimal; evidenceId: string }>();
  for (const source of input.sources) {
    for (const atom of extractNumericAtoms(source.sourceText)) {
      const value = parseDecimal(atom.value);
      if (!value || decimalCompare(value, targetValue) === 0) continue;
      if (isPercentAt(source.sourceText, atom) !== targetPercent) continue;
      if (!includesDecimal(verified, value)) continue;
      const key = formatDecimal(value);
      if (!candidates.has(key)) candidates.set(key, { value, evidenceId: source.evidenceId });
    }
  }
  if (candidates.size !== 1) return null;
  const [only] = candidates.values();
  const from = input.claimText.slice(target.charStart, target.charEnd);
  return { from, to: formatLike(from, only!.value), evidenceId: only!.evidenceId };
}
