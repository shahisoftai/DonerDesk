import type { FastifyInstance } from "fastify";
import { HomeLayoutQuerySchema, SaveHomeLayoutSchema } from "@donordesk/contracts";

/** A person's own arrangement of Home (Phase 40). Thin: validate, call one handler, throw its error. Every handler works on the caller's row only. */
export async function registerHomeLayoutRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });

  app.get("/v1/home-layout", async (req) => {
    const r = await req.container.handlers.getHomeLayout.handle(ctx(req), HomeLayoutQuerySchema.parse(req.query).variant);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/home-layout", async (req) => {
    const r = await req.container.handlers.saveHomeLayout.handle(ctx(req), SaveHomeLayoutSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/home-layout", async (req) => {
    const r = await req.container.handlers.resetHomeLayout.handle(ctx(req), HomeLayoutQuerySchema.parse(req.query).variant);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
