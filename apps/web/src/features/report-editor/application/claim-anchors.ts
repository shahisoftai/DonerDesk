/**
 * Anchors checked statements to their text in a section's markdown (the
 * verifier's coordinate space), so problems can be highlighted where they
 * are (Report Editor §4.3):
 *   1. the verifier's span, when it still holds the statement;
 *   2. otherwise an exact search, then a case/whitespace/markup-insensitive
 *      search (bold, links, code inside the statement) — first unused match;
 *   3. otherwise unanchored: shown only in the Statements tab.
 * Anchors never cross a line (block) or a table cell. Pure.
 */

export type AnchorClaim = { id: string; text: string; charStart?: number | null; charEnd?: number | null };
export type Anchor = { start: number; end: number };

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Searchable view of markdown: inline markup (`*`, `` ` ``, `[`, `]`, link
 * targets, backslashes) removed, whitespace collapsed, lower-cased — with
 * the markdown offset of every kept character.
 */
export function searchIndex(markdown: string): { text: string; offsets: number[] } {
  const chars: string[] = [];
  const offsets: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < markdown.length; i += 1) {
    const ch = markdown[i]!;
    if (ch === "]" && markdown[i + 1] === "(") {
      const close = markdown.indexOf(")", i + 2);
      if (close !== -1) {
        i = close;
        continue;
      }
    }
    if (ch === "*" || ch === "`" || ch === "[" || ch === "]" || ch === "\\") continue;
    if (/\s/.test(ch)) {
      if (!lastSpace) {
        chars.push(" ");
        offsets.push(i);
        lastSpace = true;
      }
      continue;
    }
    chars.push(ch.toLowerCase());
    offsets.push(i);
    lastSpace = false;
  }
  return { text: chars.join(""), offsets };
}

/** Clips a range so it stays inside one line and one table cell. */
export function clipToBlock(markdown: string, anchor: Anchor): Anchor {
  let end = anchor.end;
  const newline = markdown.indexOf("\n", anchor.start);
  if (newline !== -1 && newline < end) end = newline;
  const lineStart = markdown.lastIndexOf("\n", anchor.start - 1) + 1;
  if (markdown.slice(lineStart).trimStart().startsWith("|")) {
    for (let i = anchor.start; i < end; i += 1) {
      if (markdown[i] === "|" && markdown[i - 1] !== "\\") {
        end = i;
        break;
      }
    }
  }
  while (end > anchor.start && /\s/.test(markdown[end - 1]!)) end -= 1;
  return { start: anchor.start, end };
}

const overlaps = (a: Anchor, b: Anchor) => a.start < b.end && b.start < a.end;

function freeMatch(haystack: string, needle: string, used: Anchor[], toAnchor: (index: number) => Anchor): Anchor | null {
  if (!needle) return null;
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return null;
    const anchor = toAnchor(index);
    if (!used.some((u) => overlaps(u, anchor))) return anchor;
    from = index + 1;
  }
}

/**
 * Anchors every claim; `null` = unanchored ("wording changed since it was
 * checked"). Claims with a valid verifier span are placed first so a search
 * never steals their text.
 */
export function anchorClaims(markdown: string, claims: ReadonlyArray<AnchorClaim>): Map<string, Anchor | null> {
  const result = new Map<string, Anchor | null>();
  const used: Anchor[] = [];
  const pending: AnchorClaim[] = [];

  for (const claim of claims) {
    const { charStart: s, charEnd: e } = claim;
    if (s != null && e != null && s >= 0 && e > s && e <= markdown.length && collapse(markdown.slice(s, e)) === collapse(claim.text)) {
      const anchor = clipToBlock(markdown, { start: s, end: e });
      result.set(claim.id, anchor);
      used.push(anchor);
    } else {
      pending.push(claim);
    }
  }

  let index: ReturnType<typeof searchIndex> | null = null;
  for (const claim of pending) {
    const text = claim.text.trim();
    let anchor = freeMatch(markdown, text, used, (i) => ({ start: i, end: i + text.length }));
    if (!anchor) {
      index ??= searchIndex(markdown);
      const needle = searchIndex(text).text;
      const offsets = index.offsets;
      anchor = freeMatch(index.text, needle, used, (i) => ({ start: offsets[i]!, end: offsets[i + needle.length - 1]! + 1 }));
    }
    if (anchor) {
      anchor = clipToBlock(markdown, anchor);
      used.push(anchor);
    }
    result.set(claim.id, anchor && anchor.end > anchor.start ? anchor : null);
  }
  return result;
}

/**
 * Locates plain text (e.g. an editor selection) in markdown, returning its
 * markdown range including any markup inside it. Used by "Ask AI" on a
 * selection to address the stored text. The first match wins; `null` when
 * the text is not in the markdown.
 */
export function locatePlainText(markdown: string, plain: string): Anchor | null {
  const index = searchIndex(markdown);
  const needle = searchIndex(plain).text;
  if (!needle) return null;
  const at = index.text.indexOf(needle);
  if (at === -1) return null;
  let start = index.offsets[at]!;
  let end = index.offsets[at + needle.length - 1]! + 1;
  // Include emphasis markers hugging the selection so formatting stays balanced.
  while (start > 0 && (markdown[start - 1] === "*" || markdown[start - 1] === "`")) start -= 1;
  while (end < markdown.length && (markdown[end] === "*" || markdown[end] === "`")) end += 1;
  return { start, end };
}
