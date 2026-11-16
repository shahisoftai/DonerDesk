/**
 * The places sheet shortcut: a document that is a places list (the places import's own columns: Name, Level, Parent, Code,
 * Latitude, Longitude…) is read by the places import's parser, not the model. Each place is quoted by its own sheet line. A
 * document without a Name and a Level header is not a places sheet and returns null, so the model reads it as usual.
 */
import { parsePlaceSheet, type PlaceDef, type Proposed, type SourceBlock } from "@donordesk/domain";
import { FIELD_LIMITS, fit } from "./fit-text.js";
import type { SheetReader } from "./sheet-readers.js";

const QUOTE_LIMIT = 1000;

function readDocument(blocks: ReadonlyArray<SourceBlock>): Proposed<PlaceDef>[] {
  const lines = blocks.flatMap((block) => block.text.split("\n").map((line) => ({ line, block })));
  const { rows } = parsePlaceSheet(lines.map((l) => l.line).join("\n"));
  if (rows.length < 2) return [];
  return rows.flatMap((row) => {
    const found = lines[row.row - 1];
    if (!found) return [];
    const value: PlaceDef = {
      name: fit(row.name, FIELD_LIMITS.title), adminLevel: row.adminLevel, parentName: fit(row.parentName ?? null, FIELD_LIMITS.title),
      latitude: row.latitude ?? null, longitude: row.longitude ?? null,
      ...(row.code ? { code: row.code } : {}),
    };
    return [{
      value, sourceQuote: found.line.trim().slice(0, QUOTE_LIMIT),
      sourceRef: { documentId: found.block.documentId, block: found.block.index, ...(found.block.page !== undefined ? { page: found.block.page } : {}) },
      confidence: "HIGH" as const, status: "PROPOSED" as const,
    }];
  });
}

/** Places from the first document that is a places sheet; never lines mixed across files. */
export const placeSheetReader: SheetReader = (blocks) => {
  const byDocument = new Map<string, SourceBlock[]>();
  for (const block of blocks) byDocument.set(block.documentId, [...(byDocument.get(block.documentId) ?? []), block]);
  for (const document of byDocument.values()) {
    const places = readDocument(document);
    if (places.length >= 2) return { places };
  }
  return null;
};
