import { normalizeSectionMarkdown } from "@donordesk/domain/contexts/reporting/section-markdown.js";

/**
 * Bridges the rich-text editor's markdown serializer and the stored section
 * format. The serializer is CommonMark-correct but writes things our
 * exporters and verifier do not expect:
 *   - HTML entities (`&amp;`, `&lt;`) — exports would print them literally
 *     and claim offsets / number grounding would drift;
 *   - backslash escapes (`\*`, `\_`) — the DOCX/PDF/donor renderers do not
 *     unescape, so users would see backslashes;
 *   - padded table cells — noisy diffs and bloated storage.
 * `toStorageMarkdown` undoes those and applies the same domain normalisation
 * the api runs on save, so an unedited section round-trips to itself.
 * Pure; unit-tested with a round-trip corpus.
 */

const ENTITY_MAP: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
};

export function decodeSerializerEntities(text: string): string {
  // `&amp;` last so "&amp;lt;" (a literal "&lt;") decodes to "&lt;".
  return text.replace(/&(?:lt|gt|quot|nbsp|#39|#x27|#160);/g, (m) => ENTITY_MAP[m] ?? m).replace(/&amp;/g, "&");
}

const ALWAYS_UNESCAPE = /\\([_#.\-+!()[\]>~`\\])/g;

/**
 * Removes serializer backslash escapes. `\*` is kept only where removing it
 * could open emphasis (a `*` touching non-space on both sides, e.g. `a\*b`);
 * table pipes (`\|`) are kept.
 */
export function unescapeSerializerOutput(text: string): string {
  let out = text.replace(ALWAYS_UNESCAPE, "$1");
  out = out.replace(/\\\*/g, (match, offset: number, whole: string) => {
    const before = offset > 0 ? whole[offset - 1]! : " ";
    const after = whole[offset + 2] ?? " ";
    return /\s/.test(before) || /\s/.test(after) ? "*" : match;
  });
  return out;
}

const SEPARATOR_CELL_RE = /^:?-{3,}:?$/;

/** Collapses padded GFM table rows to `| a | b |` and separators to `| --- |`. */
export function compactTables(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) return line;
      const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
      const cells = inner.split(/(?<!\\)\|/).map((c) => c.trim());
      const isSeparator = cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c));
      return `| ${cells.map((c) => (isSeparator ? "---" : c)).join(" | ")} |`;
    })
    .join("\n");
}

/** Canonical stored form of any section markdown (original or edited). */
export function canonicalSectionMarkdown(markdown: string): string {
  return normalizeSectionMarkdown(compactTables(markdown));
}

/** Converts the editor serializer's output into the stored section format. */
export function toStorageMarkdown(serialized: string): string {
  return canonicalSectionMarkdown(unescapeSerializerOutput(decodeSerializerEntities(serialized)));
}
