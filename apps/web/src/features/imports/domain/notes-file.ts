/**
 * The notes an import gave (rows it skipped, columns it did not understand) as a small file to keep and work through. Pure.
 * One note per line, in a "Note" column; a note that contains a comma, a quote or a line break is quoted.
 */
const cell = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function importNotesFile(notes: ReadonlyArray<string>): string {
  return ["Note", ...notes.map((n) => cell(n.replace(/\s+/g, " ").trim()))].join("\n") + "\n";
}
