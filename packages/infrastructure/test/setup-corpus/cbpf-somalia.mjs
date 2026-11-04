// A real pooled-fund proposal (CBPF Somalia, Standard Allocation 2 2025): mostly label|value tables, an unfilled logframe
// ("To be completed after identification of priority interventions"), HRP objectives beside the results table, a lump-sum
// budget. Live runs only: the file holds a real person's contact details, so it is not kept in the repository; point
// SETUP_EVAL_DOCS_DIR at the folder that holds it. Each check names what a correct reading must (or must not) contain.
export const FILE = "CBPF-SOM-25-S-NGO-37159.docx";

const v = (i) => (i && typeof i === "object" && "value" in i ? i.value : i);
const titles = (items) => (items ?? []).map((i) => String(v(i)?.title ?? v(i)?.name ?? v(i)?.category ?? "")).filter(Boolean);

export const CHECKS = [
  ["facts: start date 2025-09-01", (f) => v(f.facts?.startDate) === "2025-09-01"],
  ["facts: end date 2026-02-28", (f) => v(f.facts?.endDate) === "2026-02-28"],
  ["facts: code CBPF-SOM-25-S-NGO-37159", (f) => v(f.facts?.code) === "CBPF-SOM-25-S-NGO-37159"],
  ["facts: currency USD", (f) => v(f.facts?.currency) === "USD"],
  ["facts: country Somalia", (f) => (v(f.facts?.countries) ?? []).some((c) => /somalia/i.test(c))],
  ["facts: summary has no template placeholder", (f) => !/\[insert/i.test(String(v(f.facts?.summary) ?? ""))],
  ["logframe: no HRP/strategic objective as a result", (f) => !titles(f.logframe).some((t) => /prevent loss of life|sustain people/i.test(t)) && !(f.logframe ?? []).some((i) => /^SO\d/i.test(String(v(i)?.code ?? "")))],
  ["logframe: the five activities of the narrative", (f) => (f.logframe ?? []).filter((i) => v(i)?.level === "ACTIVITY").length >= 5],
  ["logframe: no placeholder item", (f) => !titles(f.logframe).some((t) => /to be completed|^activity [\d.]+$/i.test(t))],
  ["indicators: people reached with emergency water services", (f) => titles(f.indicators).some((t) => /people reached with emergency water/i.test(t))],
  ["plan: no placeholder plan item", (f) => !titles(f.plan).some((t) => /to be completed|^activity [\d.]+/i.test(t))],
  ["places: Baidoa, without a country called Baydhaba", (f) => titles(f.places).some((t) => /baidoa/i.test(t)) && !(f.places ?? []).some((i) => /baydhaba/i.test(String(v(i)?.name)) && v(i)?.adminLevel === 0)],
  ["funding: 500,000.30 readable, in USD", (f) => (f.funding ?? []).some((i) => /500,?000\.30/.test(String(v(i)?.amount)) && v(i)?.currency === "USD")],
  ["budget: G.1 467,290.00", (f) => (f.budget ?? []).some((i) => /467,?290/.test(String(v(i)?.amount)))],
  ["risks: insecurity named", (f) => titles(f.risks).some((t) => /insecurity/i.test(t))],
];
