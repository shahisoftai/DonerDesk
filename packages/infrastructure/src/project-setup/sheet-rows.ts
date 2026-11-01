/**
 * Sheet rows split by a cell that holds line breaks (Phase 37.2): the row's first cell (its code) stays on the first line and
 * the rest of the cells land on later ones. `joinBrokenRows` puts every line that does not start a row back on the row before
 * it, with a space — the same reading of a line break the quote check uses — so the row keeps its code, its amounts and its
 * dates. Blank lines are dropped. Pure.
 */
export function joinBrokenRows(lines: ReadonlyArray<string>, startsRow: (firstCell: string) => boolean): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const starts = line.startsWith("\t") || line.startsWith("#") || startsRow((line.split("\t")[0] ?? "").trim());
    if (starts || out.length === 0) out.push(line);
    else out[out.length - 1] = `${out[out.length - 1]} ${line}`;
  }
  return out;
}
