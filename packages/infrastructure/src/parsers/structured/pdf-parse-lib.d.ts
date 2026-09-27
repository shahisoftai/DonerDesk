/**
 * `@types/pdf-parse` only types the package root, which we deliberately avoid
 * importing (see the comment in readers.ts). This ambient declaration types
 * the `lib/pdf-parse.js` subpath we actually load.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  function PdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<{ numpages: number; numrender: number; info: unknown; metadata: unknown; text: string; version: string }>;
  export default PdfParse;
}
