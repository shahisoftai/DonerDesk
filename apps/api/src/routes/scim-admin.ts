import type { FastifyInstance } from "fastify";
import { z } from "zod";

/**
 * SCIM provisioning credentials for this organisation. The token is shown once,
 * when it is issued, and only its hash is kept.
 */
const IssueCredentialSchema = z.object({ name: z.string().min(2).max(120) });

export async function registerScimAdminRoutes(app: FastifyInstance) {
  app.get("/v1/scim/credentials", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listScimCredentials.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/scim/credentials", async (req) => {
    const body = IssueCredentialSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.issueScimCredential.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/scim/credentials/:id", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.revokeScimCredential.handle(ctx, (req.params as { id: string }).id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
