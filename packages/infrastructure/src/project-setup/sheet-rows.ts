/**
 * Sheet rows split by a cell that holds line breaks (Phase 37.2): the row's first cell (its code) stays on the first line and
 * the rest of the cells land on later ones. `joinBrokenRows` puts every line that does not start a row back on the row before
 * it, with a space — the same reading of a line break the quote check uses — so the row keeps its code, its amounts and its
 * dates. Blank lines are dropped. Pure.
 */
export function joinBrokenRows(lines: ReadonlyArray<string>, startsRow: (firstCell: string) => boolean): string[] {
  return joinedRows(lines, startsRow).map((r) => r.line);
}

export interface JoinedRow {
  /** The whole row, its pieces joined with a space. */
  line: string;
  /** The row's first physical line: what to look for when finding the block the row starts in (a long row may run into the next block). */
  first: string;
}

export function joinedRows(lines: ReadonlyArray<string>, startsRow: (firstCell: string) => boolean): JoinedRow[] {
  const out: JoinedRow[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const starts = line.startsWith("\t") || line.startsWith("#") || startsRow((line.split("\t")[0] ?? "").trim());
    if (starts || out.length === 0) out.push({ line, first: line });
    else out[out.length - 1] = { line: `${out[out.length - 1]!.line} ${line}`, first: out[out.length - 1]!.first };
  }
  return out;
}
