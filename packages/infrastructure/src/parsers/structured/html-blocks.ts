import type { DocumentBlock } from "@donordesk/application";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

export function htmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      const known = ENTITIES[e.toLowerCase()];
      if (known !== undefined) return known;
      if (e.startsWith("#x") || e.startsWith("#X")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

interface Element {
  tag: string;
  inner: string;
}

/** Top-level elements among `tags`, honouring nesting of any tracked tag. */
function topLevel(html: string, tags: readonly string[]): Element[] {
  const re = new RegExp(`<(/?)(${tags.join("|")})\\b[^>]*?(/?)>`, "gi");
  const out: Element[] = [];
  const stack: string[] = [];
  let start = -1;
  let startTag = "";
  let innerStart = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const closing = m[1] === "/";
    const selfClosing = m[3] === "/";
    const tag = m[2]!.toLowerCase();
    if (selfClosing) continue;
    if (!closing) {
      if (stack.length === 0) {
        start = m.index;
        startTag = tag;
        innerStart = m.index + m[0].length;
      }
      stack.push(tag);
      continue;
    }
    const idx = stack.lastIndexOf(tag);
    if (idx === -1) continue;
    stack.length = idx;
    if (stack.length === 0 && start >= 0) {
      out.push({ tag: startTag, inner: html.slice(innerStart, m.index) });
      start = -1;
    }
  }
  return out;
}

function listItems(inner: string, ordered: boolean, depth: number, out: DocumentBlock[]): void {
  for (const li of topLevel(inner, ["li", "ul", "ol", "table"])) {
    if (li.tag !== "li") continue;
    const nested = topLevel(li.inner, ["ul", "ol"]);
    let own = li.inner;
    for (const n of nested) own = own.replace(n.inner, "");
    const text = htmlText(own);
    if (text) out.push({ kind: "LIST_ITEM", text, ordered, depth });
    for (const n of nested) listItems(n.inner, n.tag === "ol", depth + 1, out);
  }
}

function tableRows(inner: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let r: RegExpExecArray | null;
  while ((r = rowRe.exec(inner)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(r[1]!)) !== null) cells.push(htmlText(c[1]!));
    if (cells.some((x) => x)) rows.push(cells);
  }
  return rows;
}

/** Converts mammoth HTML into ordered document blocks (headings, paragraphs, lists, tables). */
export function htmlToBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  for (const el of topLevel(html, ["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "table"])) {
    if (/^h[1-6]$/.test(el.tag)) {
      const text = htmlText(el.inner);
      if (text) blocks.push({ kind: "HEADING", level: Number(el.tag.slice(1)), text });
    } else if (el.tag === "p") {
      const text = htmlText(el.inner);
      if (!text) continue;
      const emphasis = /^\s*<(strong|b)>[\s\S]*<\/\1>\s*$/i.test(el.inner) && !/<\/(strong|b)>[\s\S]*\S[\s\S]*<(strong|b)>/i.test(el.inner);
      blocks.push(emphasis ? { kind: "PARAGRAPH", text, emphasis: true } : { kind: "PARAGRAPH", text });
    } else if (el.tag === "ul" || el.tag === "ol") {
      listItems(el.inner, el.tag === "ol", 0, blocks);
    } else if (el.tag === "table") {
      const rows = tableRows(el.inner);
      if (rows.length > 0) blocks.push({ kind: "TABLE", rows });
    }
  }
  return blocks;
}
