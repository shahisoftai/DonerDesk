/** Shared by every text import parser: header names compared loosely, and a delimited line split with quoted cells. */
export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Splits a delimited line into cells using only the detected delimiter, so
 * text fields may safely contain the other punctuation characters.
 */
export function splitDelimited(line: string, delimiter?: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  const splitsOn = delimiter ? (ch: string) => ch === delimiter : (ch: string) => ch === "\t" || ch === "," || ch === ";";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (splitsOn(ch)) {
      if (inQuotes) {
        current += ch;
      } else {
        cells.push(current.trim());
        current = "";
      }
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** The delimiter a line uses: tab, then comma, then semicolon; empty when it has none. */
export function detectDelimiter(line: string): string {
  return line.includes("\t") ? "\t" : line.includes(",") ? "," : line.includes(";") ? ";" : "";
}

/**
 * Finds the header row among the first ten lines. Blank lines, `#` comments and lines
 * without a delimiter are skipped; `isHeader` decides from the normalised cells, so each
 * import keeps its own rule for what counts as its header.
 */
export function findHeaderRow(
  lines: string[],
  isHeader: (normalizedHeaders: string[]) => boolean,
): { index: number; delimiter: string } | null {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const delimiter = detectDelimiter(trimmed);
    if (!delimiter) continue;
    if (isHeader(splitDelimited(trimmed, delimiter).map(normalizeHeader))) return { index: i, delimiter };
  }
  return null;
}
