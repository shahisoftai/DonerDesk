/**
 * Driver analysis (§3.11, D4): which groups differ on a figure. Explainable only: for each candidate (a grouping column), the group whose
 * mean differs most from the rest, a standardised effect size (Cohen's d), the group sizes and a seeded bootstrap interval. It refuses
 * when a group has fewer than 8 rows, a candidate is constant, or two candidates group the rows identically. The sentence states a
 * difference, never a cause. Run on aggregated rows (place × period), never on person-level rows.
 */
export const MIN_GROUP_ROWS = 8;
const BOOTSTRAP = 400;

export interface DriverRow { outcome: number | null; attributes: Record<string, string | null> }
export interface DriverCandidate { key: string; label: string }

export type DriverResult =
  | { status: "RANKED"; candidate: string; label: string; group: string; difference: number; effect: number; n: number; nRest: number; interval: [number, number]; sentence: string }
  | { status: "REFUSED"; candidate: string; label: string; reason: string };

/** A small deterministic generator (mulberry32) so the same rows always give the same interval. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: readonly number[]): number => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
const r1 = (n: number): number => Math.round(n * 10) / 10;

export function rankDrivers(rows: readonly DriverRow[], outcomeLabel: string, candidates: readonly DriverCandidate[], seed = 54): DriverResult[] {
  const usable = rows.filter((r) => r.outcome !== null && Number.isFinite(r.outcome));
  const results: DriverResult[] = [];
  const partitions = new Map<string, string>();
  for (const c of candidates) {
    const values = usable.map((r) => r.attributes[c.key] ?? null);
    const distinct = new Set(values.filter((v) => v !== null));
    if (distinct.size < 2) { results.push({ status: "REFUSED", candidate: c.key, label: c.label, reason: `${c.label} is the same on every row, so it cannot explain a difference.` }); continue; }
    const signature = JSON.stringify(values.map((v) => (v === null ? -1 : [...distinct].indexOf(v))));
    const twin = partitions.get(signature);
    if (twin) { results.push({ status: "REFUSED", candidate: c.key, label: c.label, reason: `${c.label} groups the rows exactly like ${twin}; only one of them is shown.` }); continue; }
    partitions.set(signature, c.label);
    let best: Extract<DriverResult, { status: "RANKED" }> | undefined;
    let small = false;
    for (const g of [...distinct].sort()) {
      const inG = usable.filter((r) => r.attributes[c.key] === g).map((r) => r.outcome!);
      const rest = usable.filter((r) => r.attributes[c.key] !== g && r.attributes[c.key] !== null).map((r) => r.outcome!);
      if (inG.length < MIN_GROUP_ROWS || rest.length < MIN_GROUP_ROWS) { small = true; continue; }
      const diff = mean(inG) - mean(rest);
      const pooled = Math.sqrt(((inG.length - 1) * sd(inG) ** 2 + (rest.length - 1) * sd(rest) ** 2) / Math.max(1, inG.length + rest.length - 2));
      const effect = pooled > 0 ? diff / pooled : 0;
      if (!best || Math.abs(effect) > Math.abs(best.effect)) {
        const next = rng(seed + inG.length * 31 + rest.length);
        const draws: number[] = [];
        for (let i = 0; i < BOOTSTRAP; i += 1) {
          const pick = (xs: number[]): number => mean(Array.from({ length: xs.length }, () => xs[Math.floor(next() * xs.length)]!));
          draws.push(pick(inG) - pick(rest));
        }
        draws.sort((a, b) => a - b);
        const interval: [number, number] = [r1(draws[Math.floor(BOOTSTRAP * 0.025)]!), r1(draws[Math.floor(BOOTSTRAP * 0.975)]!)];
        const sentence = `Rows where ${c.label.toLowerCase()} is ${g} had ${outcomeLabel.toLowerCase()} ${r1(Math.abs(diff))} ${diff >= 0 ? "higher" : "lower"} than the others (n = ${inG.length} vs ${rest.length}). This shows a difference, not a cause.`;
        best = { status: "RANKED", candidate: c.key, label: c.label, group: g, difference: r1(diff), effect: Math.round(effect * 100) / 100, n: inG.length, nRest: rest.length, interval, sentence };
      }
    }
    results.push(best ?? { status: "REFUSED", candidate: c.key, label: c.label, reason: small ? `Each ${c.label.toLowerCase()} group needs at least ${MIN_GROUP_ROWS} rows with a figure to compare fairly.` : `${c.label} could not be compared.` });
  }
  const ranked = results.filter((r): r is Extract<DriverResult, { status: "RANKED" }> => r.status === "RANKED").sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  return [...ranked, ...results.filter((r) => r.status === "REFUSED")];
}
