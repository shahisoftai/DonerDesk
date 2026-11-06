/**
 * A PDF as the wizard reads it (extraction audit D2, D3): headings stand alone and table rows stay "a | b | c", the shape the
 * document map and the model read for Word files. A page with no words in an otherwise digital PDF (a scanned annex) is read by
 * text recognition when the worker can, and otherwise a marker says so in the text, so a gap is visible.
 */
import type { DocumentBlock } from "@donordesk/application";
import { PdfBlockReader } from "../parsers/structured/readers.js";

/** Reads named pages of a PDF by text recognition; null when it cannot. */
export type ScannedPageReader = (input: { bytes: Buffer; name: string; pages: number[] }) => Promise<string | null>;

export function blocksToText(blocks: ReadonlyArray<DocumentBlock>): string {
  return blocks.map((b) => {
    if (b.kind === "HEADING") return `\n${b.text}\n`;
    if (b.kind === "TABLE") return b.rows.map((r) => r.join(" | ")).join("\n");
    return "text" in b ? b.text : "";
  }).join("\n").trim();
}

/** Pages with no words between 1 and the last page, given the pages words were found on. */
export function wordlessPages(blocks: ReadonlyArray<DocumentBlock>, pageCount: number): number[] {
  const found = new Set(blocks.map((b) => b.page).filter((p): p is number => typeof p === "number"));
  return Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => !found.has(p));
}

/** The PDF's text, or null when it has no text layer (a whole scan) or could not be read here: the ordinary parser then takes over. */
export async function readPdfLayout(bytes: Buffer, name: string, readScanned?: ScannedPageReader): Promise<string | null> {
  const parsed = await new PdfBlockReader().parse({ buffer: bytes, fileName: name, mimeType: "application/pdf" });
  if (!parsed.ok || parsed.value.blocks.length === 0) return null;
  const text = blocksToText(parsed.value.blocks);
  if (!text) return null;
  const pages = wordlessPages(parsed.value.blocks, parsed.value.pageCount ?? 0);
  if (pages.length === 0) return text;
  const scanned = readScanned ? await readScanned({ bytes, name, pages }).catch(() => null) : null;
  return scanned
    ? `${text}\n\nScanned pages ${pages.join(", ")} (read by text recognition)\n\n${scanned}`
    : `${text}\n\nPages with no readable text: ${pages.join(", ")}`;
}

/** The worker's text recognition for named pages; null when it is not configured, unreachable or found nothing. */
export const workerScannedPageReader = (workerUrl: string | undefined, token: string, timeoutMs = 120_000): ScannedPageReader | undefined =>
  workerUrl ? async ({ bytes, name, pages }) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), name);
    form.append("pages", pages.join(","));
    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/v1/ocr-pages`, { method: "POST", body: form, headers: token ? { "X-Internal-Token": token } : {}, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const text = ((await response.json()) as { text?: string }).text?.trim();
    return text || null;
  } : undefined;
