import type { FastifyInstance } from "fastify";

export async function registerFileRoutes(app: FastifyInstance) {
  app.get("/v1/files/:key", async (req, reply) => {
    const key = decodeURIComponent((req.params as { key: string }).key);
    if (!key.startsWith(`${req.tenant.tenantId.toString()}/`)) {
      return reply.status(404).send({ type: "https://donordesk/problems/not_found", title: "File not found", status: 404 });
    }
    try {
      const buf = await req.container.storage.read(key);
      reply.header("content-type", "application/octet-stream");
      return buf;
    } catch {
      reply.status(404).send({ type: "https://donordesk/problems/not_found", title: "File not found", status: 404 });
    }
  });
}
