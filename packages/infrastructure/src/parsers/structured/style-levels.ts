import type { DocumentBlock, TextStyle } from "@donordesk/application";

const MAX_LEVEL = 4;
/** Table/figure captions are styled on their own scale; they nest under the current heading. */
const CAPTION = /^(table|figure|fig\.|chart|graph|map|box)\s*[\dIVX]+\b/i;

function prominence(s: TextStyle): number {
  return (s.size ?? 0) * 10 + (s.bold ? 5 : 0) + (s.color && !/^(000000|auto)$/i.test(s.color) ? 3 : 0);
}

/**
 * Re-levels headings from their visual formatting when the document gives no
 * other level signal (every heading at the same level, e.g. a Word file with
 * no heading styles or a PDF). A heading nests under the nearest preceding
 * heading that is more prominent (size, then bold, then colour), so the same
 * style always lands at the same depth in the same context and a one-off
 * style cannot shift the rest of the outline. Captions and unstyled headings
 * nest one level under the current heading. Depth is capped at 4.
 * Returns the blocks unchanged when fewer than two heading styles exist.
 */
export function assignLevelsFromStyle(blocks: DocumentBlock[]): DocumentBlock[] {
  const headings = blocks.filter((b): b is Extract<DocumentBlock, { kind: "HEADING" }> => b.kind === "HEADING");
  if (headings.length < 3 || new Set(headings.map((h) => h.level)).size > 1) return blocks;
  if (new Set(headings.filter((h) => h.style && !CAPTION.test(h.text)).map((h) => h.style!.key)).size < 2) return blocks;

  const stack: number[] = [];
  return blocks.map((b) => {
    if (b.kind !== "HEADING") return b;
    if (!b.style || CAPTION.test(b.text)) return { ...b, level: Math.min(MAX_LEVEL, stack.length + 1) };
    const p = prominence(b.style);
    while (stack.length > 0 && stack[stack.length - 1]! <= p) stack.pop();
    stack.push(p);
    return { ...b, level: Math.min(MAX_LEVEL, stack.length) };
  });
}
