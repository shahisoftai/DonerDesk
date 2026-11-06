/**
 * Whether the words of an uploaded file were actually read. A parser that cannot read a file used to hand back empty
 * text and park the reason where nobody looked, so a person believed a scanned PDF was "in the system" when none of
 * its content was. One rule decides the outcome and the plain sentence that tells them; the parse-file routes and the
 * evidence record both use it.
 */
export const TEXT_EXTRACTION_STATUSES = ["EXTRACTED", "EMPTY", "FAILED", "UNSUPPORTED"] as const;
export type TextExtractionStatus = (typeof TEXT_EXTRACTION_STATUSES)[number];

export function isTextExtractionStatus(value: unknown): value is TextExtractionStatus {
  return typeof value === "string" && (TEXT_EXTRACTION_STATUSES as readonly string[]).includes(value);
}

/** Largest file the document parsers accept. Bigger files are refused up front rather than read into memory. */
export const MAX_PARSE_FILE_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "svg"]);

export interface TextExtractionAssessment {
  status: TextExtractionStatus;
  /** A sentence for the person, present for every status except EXTRACTED. Never contains a technical error. */
  message?: string;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/** The sentence shown to a person for a status other than EXTRACTED. */
export function extractionMessage(status: Exclude<TextExtractionStatus, "EXTRACTED">, fileName: string): string {
  switch (status) {
    case "FAILED":
      return `We could not read ${fileName}. The file may be damaged or password-protected. Paste the text instead, or upload a fresh copy.`;
    case "UNSUPPORTED":
      return `${fileName} is an image or a file type we cannot read words from. Type or paste the text instead.`;
    case "EMPTY":
      return `No readable text was found in ${fileName}. If it is a scanned document, paste the text instead.`;
  }
}

/**
 * Judges a parser's result. `failed` is true when the parser reported an error; a result whose text is only the file's
 * own name is the placeholder given to files with no readable words (images and unknown types). `readByOcr` says the text
 * came from text recognition of a scan, so an image or a scanned PDF that gave words counts as read.
 */
export function assessTextExtraction(input: { fileName: string; text: string; failed?: boolean; readByOcr?: boolean }): TextExtractionAssessment {
  const text = input.text.trim();
  // Words read from a scan by text recognition are words: the person is told to check them (a note), the file is not refused.
  if (input.readByOcr && text.length > 0 && !input.failed) return { status: "EXTRACTED" };
  if (input.failed) return { status: "FAILED", message: extractionMessage("FAILED", input.fileName) };
  if (IMAGE_EXTENSIONS.has(extensionOf(input.fileName)) || (text.length > 0 && text.toLowerCase() === input.fileName.trim().toLowerCase())) {
    return { status: "UNSUPPORTED", message: extractionMessage("UNSUPPORTED", input.fileName) };
  }
  if (text.length === 0) return { status: "EMPTY", message: extractionMessage("EMPTY", input.fileName) };
  return { status: "EXTRACTED" };
}
