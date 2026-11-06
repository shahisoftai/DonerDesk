/**
 * A Word document's text with its tables kept as rows (mammoth's HTML, read here without a DOM dependency). `extractRawText`
 * puts every table cell on its own line, so a label and its value, or a column heading and the figure under it, end up far
 * apart; forms such as pooled-fund proposals are almost all tables, and a reader then sees shreds. Here:
 *
 *  - a paragraph or heading is one line, followed by a blank line (as before);
 *  - a table row whose cells are each a single line becomes one line, cells joined by " | " (empty cells kept, so the columns
 *    still line up with the header row; trailing empty cells dropped);
 *  - a row with one filled cell (a layout wrapper around a whole section) gives that cell's lines unchanged, and a row whose
 *    cells hold several lines or a nested table gives each cell's lines in turn, so nothing is lost when a table is used for
 *    layout rather than data.
 * Pure. The separator is " | " and never a tab: a tab would make the whole document read as a spreadsheet.
 */
interface Node {
  tag: string;
  children: Array<Node | string>;
}

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]);
const VOID_TAGS = new Set(["br", "img", "hr"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const decode = (t: string): string =>
  t.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, e: string) => {
    const lower = e.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower]!;
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number(lower.slice(1)));
    return m;
  });

/** A small tree of the tags that matter; anything else (strong, em, a, span) is transparent. */
function parse(html: string): Node {
  const root: Node = { tag: "root", children: [] };
  const stack: Node[] = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)\b[^>]*?(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const top = stack[stack.length - 1]!;
    if (m[4] !== undefined) { top.children.push(decode(m[4])); continue; }
    const tag = m[2]!.toLowerCase();
    if (tag === "br") { top.children.push("\n"); continue; }
    if (VOID_TAGS.has(tag) || m[3]) continue;
    if (!m[1]) {
      const node: Node = { tag, children: [] };
      top.children.push(node);
      stack.push(node);
    } else {
      // Close up to the matching tag (mammoth's output is well formed; this only guards against a stray close).
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
    }
  }
  return root;
}

const inlineText = (n: Node | string): string => (typeof n === "string" ? n : n.children.map(inlineText).join(""));
const clean = (t: string): string => t.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();

/** The lines of a run of nodes: paragraphs and headings one per line with a blank line after, tables as rows. */
function linesOf(nodes: ReadonlyArray<Node | string>): string[] {
  const out: string[] = [];
  let inline = "";
  const flush = () => { const t = clean(inline); if (t) out.push(...t.split("\n"), ""); inline = ""; };
  for (const n of nodes) {
    if (typeof n === "string") { inline += n; continue; }
    if (n.tag === "table") { flush(); out.push(...tableLines(n), ""); continue; }
    if (BLOCK_TAGS.has(n.tag)) {
      flush();
      if (n.children.some((c) => typeof c !== "string" && (c.tag === "table" || BLOCK_TAGS.has(c.tag)))) out.push(...linesOf(n.children));
      else { const t = clean(inlineText(n)); if (t) out.push(...t.split("\n"), ""); }
      continue;
    }
    if (n.tag === "ul" || n.tag === "ol") { flush(); out.push(...linesOf(n.children)); continue; }
    // Transparent inline tags.
    if (n.children.some((c) => typeof c !== "string" && (c.tag === "table" || BLOCK_TAGS.has(c.tag)))) { flush(); out.push(...linesOf(n.children)); }
    else inline += inlineText(n);
  }
  flush();
  return out;
}

const rowsOf = (table: Node): Node[] => {
  const rows: Node[] = [];
  const walk = (n: Node) => { for (const c of n.children) if (typeof c !== "string") { if (c.tag === "tr") rows.push(c); else if (c.tag !== "table") walk(c); } };
  walk(table);
  return rows;
};

function tableLines(table: Node): string[] {
  const out: string[] = [];
  for (const row of rowsOf(table)) {
    const cells = row.children.filter((c): c is Node => typeof c !== "string" && (c.tag === "td" || c.tag === "th"));
    const cellLines = cells.map((c) => linesOf(c.children).filter((l) => l !== ""));
    const filled = cellLines.filter((l) => l.length > 0);
    if (filled.length === 0) continue;
    if (filled.length === 1) { out.push(...filled[0]!); continue; }
    if (cellLines.every((l) => l.length <= 1)) {
      const parts = cellLines.map((l) => l[0] ?? "");
      while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
      out.push(parts.join(" | "));
      continue;
    }
    for (const l of cellLines) out.push(...l);
  }
  return out;
}

export function docxHtmlToText(html: string): string {
  return linesOf(parse(html).children).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
