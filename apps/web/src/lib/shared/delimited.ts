/**
 * Pasted spreadsheet text → rows of cells. Handles what a spreadsheet copy or a
 * CSV file contains: tab-separated cells (a copy from Excel/Sheets), or comma /
 * semicolon-separated cells with "double-quoted" fields, so an amount written
 * as "1,200.50" in quotes stays one cell. Blank lines are skipped.
 */
export function parseDelimited(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) && !lines.some((l) => l.includes(",")) ? ";" : ",";
  return lines.map((line) => splitLine(line, delimiter));
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}
