/**
 * What a new version of a section changed, said in a few plain facts a reviewer can check at a glance: how many words were added or
 * removed and which figures appeared or disappeared. Deterministic and pure; it describes the text and never judges it.
 */
export interface RevisionChange {
  wordsBefore: number;
  wordsAfter: number;
  /** Figures (numbers as written) in the new text that were not in the old, and the other way round. Each is listed once. */
  figuresAdded: string[];
  figuresRemoved: string[];
  /** True when the text is the same apart from spacing and markup. */
  unchanged: boolean;
}

const plain = (text: string): string => text.replace(/[#*`>_]/g, "").replace(/[|[\]()]/g, " ").replace(/\s+/g, " ").trim();
const wordsOf = (text: string): string[] => (plain(text) === "" ? [] : plain(text).split(" "));

/** Numbers as written, without the thousands separator: "1,200" and "1200" are the same figure. Dates and list numbers are kept out. */
export function figuresIn(text: string): string[] {
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b/g, " ").replace(/^\s*\d+\.\s/gm, " ");
  const found = withoutDates.match(/\d[\d,]*(?:\.\d+)?%?/g) ?? [];
  return [...new Set(found.map((f) => f.replace(/,(?=\d{3})/g, "")))];
}

export function summariseRevisionChange(before: string, after: string): RevisionChange {
  const was = new Set(figuresIn(before));
  const now = new Set(figuresIn(after));
  return {
    wordsBefore: wordsOf(before).length,
    wordsAfter: wordsOf(after).length,
    figuresAdded: [...now].filter((f) => !was.has(f)),
    figuresRemoved: [...was].filter((f) => !now.has(f)),
    unchanged: plain(before) === plain(after),
  };
}

const list = (figures: string[]): string => (figures.length > 4 ? `${figures.slice(0, 4).join(", ")} and ${figures.length - 4} more` : figures.join(", "));

/** "Changed 12 words (+8); figures added: 40; figures removed: 38". */
export function describeRevisionChange(change: RevisionChange): string {
  if (change.unchanged) return "The words are the same as the version before.";
  const delta = change.wordsAfter - change.wordsBefore;
  const parts = [`${change.wordsBefore} → ${change.wordsAfter} words (${delta >= 0 ? "+" : ""}${delta})`];
  if (change.figuresAdded.length) parts.push(`figures added: ${list(change.figuresAdded)}`);
  if (change.figuresRemoved.length) parts.push(`figures removed: ${list(change.figuresRemoved)}`);
  if (!change.figuresAdded.length && !change.figuresRemoved.length) parts.push("no figure changed");
  return parts.join("; ");
}
