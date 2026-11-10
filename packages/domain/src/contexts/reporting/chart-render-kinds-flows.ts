import type { DatasetBudgetLine } from "./dataset-query.js";
import type { KindBuilt, RenderKit } from "./chart-render-kinds.js";

/**
 * Phase 48.11 flow kinds drawn from the budget lines: an alluvial (donor to cost category to result) and a chord-style circle (donor to
 * result). Both follow SPENT money, not the budget, so a line with nothing booked draws nothing, and money in more than one currency is
 * refused rather than added. A line whose result could not be read is left out and counted; it is never called "not linked".
 */
const NOT_LINKED = "Not linked to a result";
const donorOf = (l: DatasetBudgetLine): string => `Donor: ${l.donor.trim() || "No donor named"}`;
const categoryOf = (l: DatasetBudgetLine): string => `Category: ${l.category.trim() || "Uncategorised"}`;
const resultOf = (l: DatasetBudgetLine): string => `Result: ${l.result?.trim() || NOT_LINKED}`;

interface Prepared { lines: DatasetBudgetLine[]; currency: string; unknown: number }
function prepare(lines: ReadonlyArray<DatasetBudgetLine>, what: string): Prepared | string {
  const spent = lines.filter((l) => l.spent > 0);
  if (spent.length < 2) return `${what} needs at least two budget lines with spending booked against them.`;
  const currencies = [...new Set(spent.map((l) => l.currency))];
  if (currencies.length > 1) return `The spending is in more than one currency (${currencies.join(", ")}), so it cannot be drawn as one flow.`;
  const known = spent.filter((l) => l.resultUnknown !== true);
  if (known.length < 2) return "The results the spending contributes to could not be read just now, so this cannot be drawn.";
  return { lines: known, currency: currencies[0] ?? "", unknown: spent.length - known.length };
}
const unknownNote = (n: number): string[] => (n > 0 ? [`${n} ${n === 1 ? "line is" : "lines are"} left out because ${n === 1 ? "its" : "their"} result could not be read just now.`] : []);

export function alluvial(lines: ReadonlyArray<DatasetBudgetLine>, kit: RenderKit, notes: string[]): KindBuilt {
  const p = prepare(lines, "An alluvial");
  if (typeof p === "string") return p;
  const links = new Map<string, number>();
  const add = (a: string, b: string, v: number) => links.set(`${a}\u0000${b}`, (links.get(`${a}\u0000${b}`) ?? 0) + v);
  for (const l of p.lines) { add(donorOf(l), categoryOf(l), l.spent); add(categoryOf(l), resultOf(l), l.spent); }
  const data = [...links].map(([k, value]) => { const [source, target] = k.split("\u0000"); return { source, target, value }; });
  const names = [...new Set(data.flatMap((d) => [d.source!, d.target!]))].map((name) => ({ name }));
  return {
    option: { ...kit.base(false), tooltip: { trigger: "item" }, series: [{ type: "sankey", left: 24, right: 160, top: 56, bottom: 24, nodeAlign: "justify", data: names, links: data, lineStyle: { color: "gradient", curveness: 0.5 }, emphasis: { focus: "adjacency" }, label: { fontSize: 11 } }] },
    notes: [...notes, `Money follows what was spent, in ${p.currency || "the project currency"}: from each donor, through its cost category, to the result the activity contributes to. Spending on a line whose activity is not linked to a result goes to "${NOT_LINKED}".`, ...unknownNote(p.unknown)],
  };
}

/** Donors and results on one circle, joined by the money spent between them; a node's size is its total and a line's width is the amount between the two. */
export function chord(lines: ReadonlyArray<DatasetBudgetLine>, kit: RenderKit, notes: string[]): KindBuilt {
  const p = prepare(lines, "A chord diagram");
  if (typeof p === "string") return p;
  const size = new Map<string, number>();
  const links = new Map<string, number>();
  for (const l of p.lines) {
    const d = donorOf(l), r = resultOf(l);
    size.set(d, (size.get(d) ?? 0) + l.spent); size.set(r, (size.get(r) ?? 0) + l.spent);
    links.set(`${d}\u0000${r}`, (links.get(`${d}\u0000${r}`) ?? 0) + l.spent);
  }
  if (links.size < 2) return "A chord diagram needs at least two different donor-to-result links.";
  const max = Math.max(...size.values());
  const widest = Math.max(...links.values());
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item" },
      series: [{ type: "graph", layout: "circular", circular: { rotateLabel: true }, roam: false, edgeSymbol: ["none", "none"], label: { show: true, position: "right", fontSize: 11 },
        data: [...size].map(([name, v]) => ({ name, value: v, symbolSize: 14 + 30 * Math.sqrt(v / max), itemStyle: { color: name.startsWith("Donor") ? kit.palette[0] : kit.palette[1] } })),
        links: [...links].map(([k, value]) => { const [source, target] = k.split("\u0000"); return { source, target, value, lineStyle: { width: 1 + 14 * (value / widest), curveness: 0.3, opacity: 0.55 } }; }),
        emphasis: { focus: "adjacency" } }],
    },
    notes: [...notes, `Amounts are what was spent, in ${p.currency || "the project currency"}. A donor sits on one side of a line and the result it paid toward on the other; a wide line is more money.`, ...unknownNote(p.unknown)],
  };
}
