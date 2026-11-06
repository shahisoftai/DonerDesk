/**
 * Where a quote sits in its passage (Phase 37.6), pure: the passage cut into plain and marked parts. The quote is matched with
 * whitespace differences ignored (a sheet row's tabs were spaces in the quote); when it cannot be found the passage is shown
 * unmarked, never with a guessed mark.
 */
export interface PassagePart { text: string; mark: boolean }

export function highlightParts(passage: string, quote: string): PassagePart[] {
  const words = quote.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return [{ text: passage, mark: false }];
  const match = new RegExp(words.join("\\s+")).exec(passage);
  if (!match) return [{ text: passage, mark: false }];
  const parts: PassagePart[] = [];
  if (match.index > 0) parts.push({ text: passage.slice(0, match.index), mark: false });
  parts.push({ text: match[0], mark: true });
  const end = match.index + match[0].length;
  if (end < passage.length) parts.push({ text: passage.slice(end), mark: false });
  return parts;
}
