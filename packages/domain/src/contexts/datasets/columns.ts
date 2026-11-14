import { columnKind, isColumnKind } from "./column-kinds.js";
import { MAX_COLUMN_LABEL } from "./limits.js";
import type { ColumnDef, DatasetFigure } from "./model.js";
import { isSemantic, semanticOf, SEMANTICS } from "./semantics.js";

/**
 * The confirmed columns of a dataset are checked as a whole (§4.2 screen 3): every kind and meaning known and allowed together, labels
 * present and distinct, at most one column of a meaning that may appear once, rate parts that name two additive figures.
 */
export function columnProblems(columns: readonly ColumnDef[]): string[] {
  const out: string[] = [];
  if (columns.length === 0) out.push("Keep at least one column.");
  const keys = new Set<string>(), labels = new Set<string>();
  for (const c of columns) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(c.key) || keys.has(c.key)) out.push(`Column '${c.label}' has a bad or repeated key.`);
    keys.add(c.key);
    const label = c.label.trim();
    if (!label || label.length > MAX_COLUMN_LABEL) out.push(`Each column needs a name of 1 to ${MAX_COLUMN_LABEL} characters.`);
    if (labels.has(label.toLowerCase())) out.push(`Two columns are called '${label}'.`);
    labels.add(label.toLowerCase());
    if (!isColumnKind(c.kind)) { out.push(`'${label}': choose what the column holds.`); continue; }
    if (!isSemantic(c.semantic)) { out.push(`'${label}': choose what the column means.`); continue; }
    const sem = semanticOf(c.semantic)!;
    if (!sem.kinds.includes(c.kind)) out.push(`'${label}' is ${columnKind(c.kind)!.label.toLowerCase()}, so it cannot be the ${sem.label.toLowerCase()}.`);
    if (c.rateParts) {
      if (columnKind(c.kind)!.fieldType !== "RATE") out.push(`'${label}' is not a rate, so it has no parts.`);
      for (const part of [c.rateParts.numerator, c.rateParts.denominator]) {
        const pc = columns.find((x) => x.key === part);
        if (!pc || !columnKind(pc.kind)?.additive) out.push(`'${label}': its parts must be two figures that can be added up.`);
      }
    }
  }
  for (const sem of SEMANTICS.filter((s) => s.unique)) {
    if (columns.filter((c) => c.semantic === sem.key).length > 1) out.push(`Only one column can be the ${sem.label.toLowerCase()}.`);
  }
  return [...new Set(out)];
}

/** A dataset's own figures (a rate worked out from two columns): like with like, never from a rate. */
export function figureProblems(figures: readonly DatasetFigure[], columns: readonly ColumnDef[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>(columns.map((c) => c.key));
  for (const f of figures) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(f.id) || ids.has(f.id)) out.push(`'${f.label}' needs its own name.`);
    ids.add(f.id);
    if (!f.label.trim()) out.push("Each figure needs a name.");
    const needTwo = f.op !== "SUM";
    if (needTwo ? f.terms.length !== 2 : f.terms.length < 2) { out.push(`'${f.label}': ${needTwo ? "choose two figures" : "choose at least two figures"}.`); continue; }
    const kinds = new Set<string>();
    for (const t of f.terms) {
      const c = columns.find((x) => x.key === t);
      const k = c ? columnKind(c.kind) : undefined;
      if (!k || k.role !== "FIGURE") { out.push(`'${f.label}': '${t}' is not a figure of this dataset.`); continue; }
      if (k.fieldType === "RATE") out.push(`'${f.label}': ${c!.label} is a rate; rates are never added, subtracted or divided.`);
      kinds.add(k.money ? "MONEY" : "COUNT");
    }
    if (kinds.size > 1) out.push(`'${f.label}' compares money with counts.`);
  }
  return out;
}

/**
 * The plain-words reading of a figure (§3.3): "Cured as a share of Exits, as a percentage". Shown under the figure's name so a reader
 * knows exactly what it is, and that a rate is Σ part ÷ Σ whole over the rows of each group.
 */
export function describeFigure(f: DatasetFigure, columns: readonly ColumnDef[]): string {
  const name = (k: string): string => columns.find((c) => c.key === k)?.label ?? k;
  const [a, b] = [name(f.terms[0] ?? ""), name(f.terms[1] ?? "")];
  const words: Record<DatasetFigure["op"], () => string> = {
    RATIO: () => `${a} divided by ${b}${f.percent ? ", as a percentage" : ""}. Over several rows it is the total of ${a} divided by the total of ${b}, never an average of rates.`,
    SHARE: () => `${a} as a share of ${b}${f.percent ? ", as a percentage" : ""}. Over several rows it is the total of ${a} divided by the total of ${b}, never an average of rates.`,
    SUM: () => `${f.terms.map(name).join(" + ")}.`,
    DIFFERENCE: () => `${a} minus ${b}.`,
  };
  return words[f.op]();
}
