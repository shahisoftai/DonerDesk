import type { FastifyInstance } from "fastify";

/**
 * `POST <path>` takes one multipart file and answers with its text, or with a plain-language refusal (empty file,
 * too large, damaged, a scan with no words) so a screen never shows an empty box with no explanation.
 */
export function registerParseFileRoute(app: FastifyInstance, path: string): void {
  app.post(path, async (req) => {
    const data = await req.file();
    if (!data) throw new Error("file required");
    const buffer = await data.toBuffer();
    const r = await req.container.handlers.parseUploadedFile.handle({
      buffer,
      fileName: data.filename ?? "upload",
      fileType: data.mimetype ?? "application/octet-stream",
    });
    if (!r.ok) throw r.error;
    return r.value;
  });
}
