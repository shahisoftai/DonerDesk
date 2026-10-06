import { decimalCompare, decimalDivide, decimalMultiply, decimalRound, parseDecimal, type Decimal } from "./indicator-calculator.js";
import { isReportedFinding, type VerifiedFinding } from "./verified-finding.js";

/**
 * "This matches a verified indicator": whether every figure a statement states is one a verified finding legitimately
 * has (its period, cumulative, previous, life-of-project, baseline or target value, or the percent of target of the
 * period, cumulative or life-of-project value). When it is, a person can confirm it in one click instead of writing a note.
 */
export interface FigureAtom {
  value: string;
  role: string;
  isPercent?: boolean | undefined;
}

/** Atoms that are not results (dates, counts of things, ids) never need a finding behind them. */
const IGNORED_ROLES: ReadonlySet<string> = new Set(["DATE", "COUNT"]);

function allowedFor(finding: VerifiedFinding): { plain: Decimal[]; percent: Decimal[] } {
  const plain: Decimal[] = [];
  const percent: Decimal[] = [];
  const push = (list: Decimal[], text: string | undefined) => {
    const d = text === undefined ? null : parseDecimal(text);
    if (d) list.push(d);
  };
  for (const text of [finding.value, finding.cumulativeValue, finding.priorCumulativeValue, finding.lifeOfProject?.value, finding.baseline, finding.target, finding.comparisonValue]) push(plain, text);
  for (const entry of [...(finding.disaggregation ?? []), ...(finding.lifeOfProject?.disaggregation ?? [])]) push(plain, entry.value);
  const target = finding.target ? parseDecimal(finding.target) : null;
  if (target && target.value !== 0n) {
    for (const numerator of [finding.value, finding.cumulativeValue, finding.lifeOfProject?.value]) {
      const n = numerator ? parseDecimal(numerator) : null;
      const ratio = n ? decimalDivide(n, target, 6) : null;
      if (!ratio) continue;
      const raw = decimalMultiply(ratio, { value: 100n, scale: 0 });
      for (const digits of [0, 1, 2]) percent.push(decimalRound(raw, digits));
    }
  }
  // A plain figure may also be quoted as a percentage (a rate of 76 is "76%").
  percent.push(...plain);
  return { plain, percent };
}

/** The indicator codes that explain every result figure of the statement, or undefined when any figure is unexplained. */
export function findingsExplaining(atoms: ReadonlyArray<FigureAtom>, findings: ReadonlyArray<VerifiedFinding>): string[] | undefined {
  const figures = atoms.filter((a) => !IGNORED_ROLES.has(a.role));
  if (figures.length === 0) return undefined;
  const reported = findings.filter(isReportedFinding).map((f) => ({ code: f.indicatorCode, allowed: allowedFor(f) }));
  const codes = new Set<string>();
  for (const atom of figures) {
    const value = parseDecimal(atom.value);
    if (!value) return undefined;
    const match = reported.find((f) => (atom.isPercent ? f.allowed.percent : f.allowed.plain).some((d) => decimalCompare(d, value) === 0));
    if (!match) return undefined;
    codes.add(match.code);
  }
  return [...codes];
}
