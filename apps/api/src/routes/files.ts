import type { FastifyInstance } from "fastify";
import { mayReadEvidence, type Role } from "@donordesk/domain";

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
    // A file that is evidence is served only to a caller who may read its
    // confidentiality level. Files the app produced (exports) have no evidence
    // record and keep their existing behaviour.
    const found = await req.container.evidence.findByStorageKey(key, req.tenant.tenantId);
    if (found.ok && found.value) {
      const reader = { userId: req.tenant.userId, role: req.tenant.role as Role };
      if (!mayReadEvidence(reader, found.value)) {
        return reply.status(403).send({
          type: "https://donordesk/problems/forbidden",
          title: "This file is restricted",
          status: 403,
        });
      }
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
