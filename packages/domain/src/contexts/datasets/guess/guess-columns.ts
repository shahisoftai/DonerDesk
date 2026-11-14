import { columnKind } from "../column-kinds.js";
import type { CellValue, ColumnDef, RawTable } from "../model.js";
import { SEMANTICS, semanticOf } from "../semantics.js";
import { isBlank } from "../parse-cells.js";
import { GUESSERS } from "./guessers.js";
import type { ColumnGuess } from "./types.js";

export interface ColumnProposal {
  column: ColumnDef;
  /** Why the kind and the meaning were guessed, in sentences; shown beside the column. */
  reasons: string[];
  confidence: number;
  samples: CellValue[];
}

const SAMPLE_LIMIT = 200;

/** A stable key from a header, unique in the table ("Total children screened" → "total_children_screened", then "_2"…). */
export function columnKeyFor(header: string, taken: Set<string>): string {
  const base = header.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "column";
  let key = /^[a-z]/.test(base) ? base : `c_${base}`;
  for (let i = 2; taken.has(key); i += 1) key = `${base}_${i}`;
  taken.add(key);
  return key;
}

function best(guesses: ColumnGuess[], prop: "kind" | "semantic"): ColumnGuess | undefined {
  return guesses.filter((g) => g[prop]).sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Every column of a table with its proposed kind and meaning (§4.2 screen 3). A semantic is kept only when the guessed kind may
 * carry it (a "Month" header with numbers in it is a count, not a period). A semantic that may appear once (the period) is given to
 * the most confident column only. Pure and deterministic.
 */
export function guessColumns(table: RawTable): ColumnProposal[] {
  const taken = new Set<string>();
  const proposals = table.headers.map((header, i) => {
    const samples = table.rows.map((r) => r[i] ?? null).filter((c) => !isBlank(c)).slice(0, SAMPLE_LIMIT);
    const guesses = GUESSERS.map((g) => g.guess({ header, samples })).filter((g): g is ColumnGuess => Boolean(g));
    const kindGuess = best(guesses, "kind");
    const kind = (kindGuess?.kind ?? "TEXT") as ColumnDef["kind"];
    const semGuess = best(guesses.filter((g) => g.semantic && semanticOf(g.semantic)?.kinds.includes(kind)), "semantic");
    const semantic = (semGuess?.semantic ?? "NONE") as ColumnDef["semantic"];
    const reasons = [kindGuess?.reason, semGuess && semGuess !== kindGuess ? semGuess.reason : undefined].filter((r): r is string => Boolean(r));
    const confidence = Math.min(kindGuess?.confidence ?? 0.3, semGuess ? semGuess.confidence : 1);
    const label = String(header ?? "").trim() || `Column ${i + 1}`;
    const column: ColumnDef = {
      key: columnKeyFor(label, taken), label, sourceHeader: String(header ?? ""), kind, semantic,
      hideOnShareLinks: semanticOf(semantic)?.shareable === false || columnKind(kind)?.money === true,
    };
    return { column, reasons, confidence, samples: samples.slice(0, 5) };
  });
  for (const sem of SEMANTICS.filter((x) => x.unique).map((x) => x.key)) {
    const holders = proposals.filter((p) => p.column.semantic === sem).sort((a, b) => b.confidence - a.confidence);
    for (const extra of holders.slice(1)) { extra.column = { ...extra.column, semantic: "NONE" }; extra.reasons.push(`Only one column can be the ${semanticOf(sem)!.label.toLowerCase()}.`); }
  }
  return proposals;
}
