/**
 * A notification or reminder message is plain text: paragraphs, a heading line ("Late"), and "- " bullet lines. Every place
 * that shows one (the Inbox, the email) reads it through this one function, so a summary is never squashed into a paragraph.
 */
export type MessageBlock =
  | { kind: "PARAGRAPH"; text: string }
  | { kind: "HEADING"; text: string }
  | { kind: "LIST"; items: string[] };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function messageBlocks(text: string): MessageBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MessageBlock[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const last = blocks[blocks.length - 1];
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "");
      if (last?.kind === "LIST") last.items.push(item);
      else blocks.push({ kind: "LIST", items: [item] });
      return;
    }
    // A short line with no closing punctuation, directly followed by a bullet, names the list below it.
    const next = lines[i + 1]?.trim() ?? "";
    if (BULLET.test(next) && line.length <= 60 && !/[.!?]$/.test(line)) {
      blocks.push({ kind: "HEADING", text: line.replace(/:$/, "") });
      return;
    }
    blocks.push({ kind: "PARAGRAPH", text: line });
  });
  return blocks;
}
