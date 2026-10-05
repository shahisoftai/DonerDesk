import type { FastifyInstance } from "fastify";

const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** The stored key's extension decides the type; unknown extensions stay opaque. */
export function contentTypeForKey(key: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(key);
  return (m && CONTENT_TYPES[m[1]!.toLowerCase()]) || "application/octet-stream";
}

export async function registerFileRoutes(app: FastifyInstance) {
  app.get("/v1/files/:key", async (req, reply) => {
    const key = decodeURIComponent((req.params as { key: string }).key);
    if (!key.startsWith(`${req.tenant.tenantId.toString()}/`)) {
      return reply.status(404).send({ type: "https://donordesk/problems/not_found", title: "File not found", status: 404 });
    }
    try {
      const buf = await req.container.storage.read(key);
      reply.header("content-type", contentTypeForKey(key));
      reply.header("x-content-type-options", "nosniff");
      return buf;
    } catch {
      reply.status(404).send({ type: "https://donordesk/problems/not_found", title: "File not found", status: 404 });
    }
  });
}
