import type { FastifyInstance } from "fastify";
import { z } from "zod";

const RecordConsentSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: "Consent must be explicitly accepted." }) }),
  source: z.enum(["onboarding", "portal", "api"]).default("onboarding"),
});

export async function registerLegalRoutes(app: FastifyInstance) {
  app.get("/v1/legal/consent", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id, ipAddress: req.ip };
    const r = await req.container.handlers.getLegalConsent.handle(ctx);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/legal/consent", async (req) => {
    const body = RecordConsentSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id, ipAddress: req.ip };
    const r = await req.container.handlers.recordLegalConsent.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
