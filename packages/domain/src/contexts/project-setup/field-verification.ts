/**
 * A second, narrow question about the values that matter most (extraction audit C3): "does this passage state this value for
 * this field?". A doubt marks the item LOW for the person to check; it never removes or changes it. Pure.
 */
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export interface VerifiableField {
  path: string;
  field: string;
  value: string;
  quote: string;
}

const FACT_FIELDS: Readonly<Record<string, string>> = { name: "project name", code: "project code", donor: "donor funding this project", startDate: "project start date", endDate: "project end date", currency: "project currency" };

const asked = (path: string, field: string, value: unknown, item: Proposed<unknown>): VerifiableField[] =>
  typeof value === "string" && value && item.sourceQuote && item.status === "PROPOSED" ? [{ path, field, value, quote: item.sourceQuote }] : [];

/** The key values of a proposal, at most `limit`: the facts, then funding amounts, then indicator targets and baselines. */
export function verifiableFields(p: ProjectSetupProposal, limit = 60): VerifiableField[] {
  const facts = Object.entries(FACT_FIELDS).flatMap(([k, field]) => { const item = p.facts[k as keyof typeof p.facts] as Proposed<unknown>; return asked(`facts.${k}`, field, item.value, item); });
  const funding = p.funding.flatMap((f, i) => asked(`funding.${i}`, `amount of funding from ${f.value?.sourceName ?? "this source"}`, f.value?.amount, f));
  const indicators = p.indicators.flatMap((n, i) => [
    ...asked(`indicators.${i}`, `target of the indicator "${n.value?.title ?? ""}"`, n.value?.target, n),
    ...asked(`indicators.${i}`, `baseline of the indicator "${n.value?.title ?? ""}"`, n.value?.baseline, n),
  ]);
  return [...facts, ...funding, ...indicators].slice(0, limit);
}

/** The proposal with every doubted path marked LOW. */
export function markDoubted(p: ProjectSetupProposal, doubted: ReadonlyArray<string>): ProjectSetupProposal {
  const low = <T>(item: Proposed<T>): Proposed<T> => ({ ...item, confidence: "LOW" });
  const paths = new Set(doubted);
  const facts = Object.fromEntries(Object.entries(p.facts).map(([k, v]) => [k, paths.has(`facts.${k}`) ? low(v as Proposed<unknown>) : v])) as unknown as ProjectSetupProposal["facts"];
  return {
    ...p, facts,
    funding: p.funding.map((f, i) => (paths.has(`funding.${i}`) ? low(f) : f)),
    indicators: p.indicators.map((n, i) => (paths.has(`indicators.${i}`) ? low(n) : n)),
  };
}
