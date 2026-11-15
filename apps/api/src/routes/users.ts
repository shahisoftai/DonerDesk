import type { FastifyInstance } from "fastify";
import { InviteUserSchema, ChangeRoleSchema, SetUserStatusSchema } from "@donordesk/contracts";

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/v1/users", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listUsers.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/users/invitations", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listPendingInvitations.handle(ctx);
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

  // An administrator clears someone's two-step sign-in (a lost phone).
  app.post("/v1/users/:id/mfa/reset", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resetUserMfa.handle(ctx, (req.params as { id: string }).id);
    if (!r.ok) throw r.error;
    return { reset: true };
  });

  // Deactivate, reactivate or delete a team member (Version 4.000). Delete is final and keeps the person's records.
  app.post("/v1/users/:id/status", async (req) => {
    const body = SetUserStatusSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.setUserStatus.handle(ctx, { userId: (req.params as { id: string }).id, action: body.action });
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Withdraw an invitation nobody has accepted (Version 4.000).
  app.delete("/v1/users/invitations/:id", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.cancelInvitation.handle(ctx, (req.params as { id: string }).id);
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
