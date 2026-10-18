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
