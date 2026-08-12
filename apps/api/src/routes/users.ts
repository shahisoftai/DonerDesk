import type { FastifyInstance } from "fastify";
import { InviteUserSchema, ChangeRoleSchema } from "@donordesk/contracts";

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/v1/users", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listUsers.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/users/invite", async (req) => {
    const body = InviteUserSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.inviteUser.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/users/role", async (req) => {
    const body = ChangeRoleSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.changeRole.handle(ctx, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
