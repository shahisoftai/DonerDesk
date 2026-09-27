/**
 * Wraps anchored statements in the rendered section (react-markdown's hast
 * tree) so problems are shown where they are. Text nodes keep the source
 * offsets of the markdown they came from; a statement that spans formatting
 * (bold, links) becomes several marks with the same claim id. Only the first
 * mark of a statement is a tab stop. No raw HTML is ever produced: marks are
 * plain `span` elements with data attributes. Pure.
 */

export type HighlightTone = "open" | "kept" | "left-out" | "verified";

export type Highlight = { claimId: string; start: number; end: number; tone: HighlightTone; label: string };

type Position = { start?: { offset?: number }; end?: { offset?: number } };
type HastText = { type: "text"; value: string; position?: Position };
type HastElement = { type: "element"; tagName: string; properties?: Record<string, unknown>; children: HastNode[]; position?: Position };
type HastNode = HastText | HastElement | { type: string; children?: HastNode[]; position?: Position; value?: string };

const SKIP_TAGS = new Set(["code", "pre"]);

function mark(h: Highlight, children: HastNode[], first: boolean, focusedId: string | undefined): HastElement {
  const properties: Record<string, unknown> = {
    className: ["claim-mark"],
    dataClaimId: h.claimId,
    dataClaimState: h.tone,
  };
  if (h.claimId === focusedId) properties.dataClaimFocused = "true";
  if (first) {
    properties.tabIndex = 0;
    properties.role = "button";
    properties.ariaLabel = h.label;
  }
  return { type: "element", tagName: "span", properties, children };
}

function splitText(node: HastText, source: string, highlights: Highlight[], seen: Set<string>, focusedId: string | undefined): HastNode[] {
  const s = node.position?.start?.offset;
  const e = node.position?.end?.offset;
  if (s === undefined || e === undefined) return [node];
  const overlapping = highlights.filter((h) => h.start < e && h.end > s).sort((a, b) => a.start - b.start);
  if (overlapping.length === 0) return [node];

  const firstOf = (h: Highlight) => {
    const first = !seen.has(h.claimId);
    seen.add(h.claimId);
    return first;
  };

  // Escapes/entities make the text differ from its source: mark it whole.
  if (source.slice(s, e) !== node.value) {
    const h = overlapping[0]!;
    return [mark(h, [node], firstOf(h), focusedId)];
  }

  const out: HastNode[] = [];
  let cursor = 0;
  for (const h of overlapping) {
    const from = Math.max(h.start, s) - s;
    const to = Math.min(h.end, e) - s;
    if (from < cursor || to <= from) continue;
    if (from > cursor) out.push({ type: "text", value: node.value.slice(cursor, from) });
    out.push(mark(h, [{ type: "text", value: node.value.slice(from, to) }], firstOf(h), focusedId));
    cursor = to;
  }
  if (cursor < node.value.length) out.push({ type: "text", value: node.value.slice(cursor) });
  return out;
}

function walk(node: HastNode, source: string, highlights: Highlight[], seen: Set<string>, focusedId: string | undefined): void {
  if (!("children" in node) || !node.children) return;
  if (node.type === "element" && SKIP_TAGS.has((node as HastElement).tagName)) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text") next.push(...splitText(child as HastText, source, highlights, seen, focusedId));
    else {
      walk(child, source, highlights, seen, focusedId);
      next.push(child);
    }
  }
  node.children = next;
}

/** Rehype plugin: `[rehypeClaimHighlights, { source, highlights, focusedId }]`. */
export function rehypeClaimHighlights(options: { source: string; highlights: Highlight[]; focusedId?: string }) {
  return (tree: HastNode) => {
    if (options.highlights.length === 0) return;
    walk(tree, options.source, options.highlights, new Set(), options.focusedId);
  };
}

/**
 * Rehype plugin marking GFM tables (by document index) that were built from
 * verified data, and those whose numbers were changed since.
 */
export function rehypeMarkVerifiedTables(options: { verified: ReadonlySet<number>; drifted: ReadonlySet<number> }) {
  return (tree: HastNode) => {
    if (options.verified.size === 0) return;
    let index = 0;
    const visit = (node: HastNode) => {
      if (node.type === "element" && (node as HastElement).tagName === "table") {
        const el = node as HastElement;
        if (options.verified.has(index)) {
          el.properties = { ...el.properties, dataVerifiedTable: options.drifted.has(index) ? "changed" : "true" };
        }
        index += 1;
        return;
      }
      if ("children" in node && node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
