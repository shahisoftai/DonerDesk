import type { DocumentBlock, StructuredDocument } from "../ports/templates.js";

function blockText(block: DocumentBlock): string {
  switch (block.kind) {
    case "HEADING":
      return block.text;
    case "PARAGRAPH":
      return block.text;
    case "LIST_ITEM":
      return `${"  ".repeat(Math.max(0, block.depth))}${block.ordered ? "1." : "-"} ${block.text}`;
    case "TABLE":
      return block.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  }
}

/** Plain-text rendering of a structured document (one block per paragraph). */
export function renderDocumentText(doc: StructuredDocument): string {
  return doc.blocks.map(blockText).filter((t) => t.trim()).join("\n\n");
}
