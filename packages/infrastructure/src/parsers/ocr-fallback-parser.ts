import type { IDocumentParser } from "@donordesk/application";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "bmp", "tif", "tiff", "webp"]);

type ParseInput = { buffer: Buffer; fileType: string; fileName: string };
type ParseOutput = { text: string; metadata?: Record<string, unknown> };

interface WorkerParseResponse {
  text?: string;
  status?: string;
  note?: string;
  ocr?: { confidence: number | null; pagesRead: number; pagesTotal: number };
}

const extensionOf = (name: string): string => name.toLowerCase().split(".").pop() ?? "";

/**
 * Wraps another parser: when it found no words in a PDF, or the file is a photographed page, the worker's text recognition reads
 * it. It is a best effort. When the worker is unreachable, has OCR switched off, or finds nothing, the first parser's answer stands,
 * so the file is reported as unreadable exactly as before. What was read by machine carries a note so the person checks it.
 */
export class OcrFallbackDocumentParser implements IDocumentParser {
  constructor(
    private readonly inner: IDocumentParser,
    private readonly workerUrl: string | undefined = process.env.AI_REPORTER_URL,
    private readonly internalToken: string = process.env.INTERNAL_TOKEN ?? "",
    private readonly timeoutMs: number = Number(process.env.OCR_TIMEOUT_MS ?? 120_000),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async parse(input: ParseInput): Promise<ParseOutput> {
    const first = await this.inner.parse(input);
    const ext = extensionOf(input.fileName);
    const isScanCandidate = ext === "pdf" || input.fileType === "application/pdf" ? first.text.trim() === "" : IMAGE_EXTENSIONS.has(ext);
    if (!isScanCandidate || !this.workerUrl || process.env.OCR_ENABLED === "0") return first;
    try {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.fileType || "application/octet-stream" }), input.fileName);
      const response = await this.fetchImpl(`${this.workerUrl.replace(/\/+$/, "")}/v1/parse`, {
        method: "POST",
        body: form,
        headers: this.internalToken ? { "X-Internal-Token": this.internalToken } : {},
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return first;
      const body = (await response.json()) as WorkerParseResponse;
      if (body.status !== "EXTRACTED" || !body.ocr || !body.text || body.text.trim() === "") return first;
      // The first parser's parse error (if any) is dropped: the file was read.
      return { text: body.text, metadata: { ocr: body.ocr, ocrNote: body.note ?? "Read by text recognition: check names and numbers." } };
    } catch {
      return first;
    }
  }
}
