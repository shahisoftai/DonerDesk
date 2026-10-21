import type { FastifyInstance } from "fastify";
import { SignUpSchema, LoginSchema, GoogleSignInSchema, ChangePasswordSchema, RequestPasswordResetSchema, ConfirmPasswordResetSchema, PasswordResetValidationResponseSchema, PasswordResetAcceptedResponseSchema, AcceptInvitationSchema, AcceptInvitationResponseSchema, InvitationPreviewSchema, LoginMfaSchema, MfaEnableSchema, MfaDisableSchema } from "@donordesk/contracts";
import { DomainError, PasswordResetToken } from "@donordesk/domain";
import { createContainer } from "@donordesk/infrastructure";
import { authMiddleware } from "../middleware/auth.js";
import { requireResidencyMatch } from "../middleware/data-residency.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/signup", async (req) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local sign-up is disabled when OIDC is enabled");
    const body = SignUpSchema.parse(req.body);
    requireResidencyMatch(body.organization.dataResidency);
    const result = await app.container.handlers.signUp.handle(body);
    if (!result.ok) throw result.error;
    return result.value;
  });

  app.post("/v1/auth/login", async (req) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local login is disabled when OIDC is enabled");
    const body = LoginSchema.parse(req.body);
    const result = await app.container.handlers.login.handle(body);
    if (!result.ok) throw result.error;
    return result.value;
  });

  // Second step of sign-in for people who turned on two-step sign-in: the challenge from the password step plus a code.
  app.post("/v1/auth/login/mfa", async (req) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local login is disabled when OIDC is enabled");
    const body = LoginMfaSchema.parse(req.body);
    const result = await app.container.handlers.completeMfaLogin.handle(body);
    if (!result.ok) throw result.error;
    return result.value;
  });

  // Managing one's own two-step sign-in. With organization SSO the identity provider owns this, so it is off here.
  // These routes sit outside the authenticated scope in server.ts, so they build the caller's tenant container themselves.
  const ownMfa = {
    preHandler: [
      authMiddleware,
      async (req: { tenant: { tenantId: { toString(): string } }; container: unknown }) => {
        req.container = createContainer({ tenantId: req.tenant.tenantId.toString() });
      },
    ] as never,
    onResponse: async (req: { container?: { settleBackgroundWork(): Promise<void>; prisma: { $disconnect(): Promise<void> } } }) => {
      await req.container?.settleBackgroundWork();
      await req.container?.prisma.$disconnect();
    },
  };
  const ctxOf = (req: { tenant: unknown; ip: string; id: string }) => ({ tenant: req.tenant as never, ipAddress: req.ip, requestId: req.id });
  const noSso = () => { if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Two-step sign-in is managed by your organization's single sign-on."); };

  app.get("/v1/auth/mfa", ownMfa, async (req) => {
    const r = await req.container.handlers.getMfaStatus.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/auth/mfa/setup", ownMfa, async (req) => {
    noSso();
    const r = await req.container.handlers.beginMfaEnrollment.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/auth/mfa/enable", ownMfa, async (req) => {
    noSso();
    const body = MfaEnableSchema.parse(req.body);
    const r = await req.container.handlers.enableMfa.handle(ctxOf(req), body.code);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/auth/mfa/disable", ownMfa, async (req) => {
    noSso();
    const body = MfaDisableSchema.parse(req.body);
    const r = await req.container.handlers.disableMfa.handle(ctxOf(req), body);
    if (!r.ok) throw r.error;
    return { disabled: true };
  });

  app.post("/v1/auth/google", async (req) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Google Sign-In is disabled when OIDC is enabled");
    const body = GoogleSignInSchema.parse(req.body);
    const result = await app.container.handlers.googleSignIn.handle(body);
    if (!result.ok) throw result.error;
    return result.value;
  });

  app.post("/v1/auth/password/change", ownMfa, async (req, reply) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local password change is disabled when OIDC is enabled");
    const body = ChangePasswordSchema.parse(req.body);
    const result = await req.container.handlers.changePassword.handle(
      {
        tenant: req.tenant,
        ipAddress: req.ip,
        requestId: req.id,
      },
      { currentPassword: body.currentPassword, newPassword: body.newPassword },
    );
    if (!result.ok) throw result.error;
    return reply.status(200).send({ changed: true });
  });

  app.post("/v1/auth/password/reset/request", async (req, reply) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local password reset is disabled when OIDC is enabled");
    const body = RequestPasswordResetSchema.parse(req.body);
    const result = await app.container.handlers.requestPasswordReset.handle({
      email: body.email,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    if (!result.ok) throw result.error;
    return reply.status(200).send(PasswordResetAcceptedResponseSchema.parse(result.value));
  });

  app.get("/v1/auth/password/reset/validate", async (req, reply) => {
    const token = typeof (req.query as { token?: unknown }).token === "string" ? (req.query as { token: string }).token : "";
    if (!token || token.length < 20) {
      return reply.status(200).send(PasswordResetValidationResponseSchema.parse({ valid: false }));
    }
    const tokenHash = PasswordResetToken.hash(token);
    const lookup = await app.container.passwordResetTokens.findActiveByHash(tokenHash);
    if (!lookup.ok || !lookup.value) {
      return reply.status(200).send(PasswordResetValidationResponseSchema.parse({ valid: false }));
    }
    const tok = lookup.value;
    const valid = !tok.isUsed() && !tok.isExpired(new Date());
    return reply.status(200).send(PasswordResetValidationResponseSchema.parse({ valid }));
  });

  app.post("/v1/auth/password/reset/confirm", async (req, reply) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Local password reset is disabled when OIDC is enabled");
    const body = ConfirmPasswordResetSchema.parse(req.body);
    const result = await app.container.handlers.confirmPasswordReset.handle({
      token: body.token,
      newPassword: body.newPassword,
      ipAddress: req.ip,
    });
    if (!result.ok) throw result.error;
    return reply.status(200).send({ confirmed: true });
  });

  // ---- Invitation acceptance (WS-C prerequisite) ----
  // Public: the single-use, time-boxed token is the capability; the handler
  // re-checks the destination seat pool at acceptance time and runs on the
  // admin connection (no tenant session exists yet).

  app.get("/v1/invitations/preview", async (req, reply) => {
    const token = typeof (req.query as { token?: unknown }).token === "string" ? (req.query as { token: string }).token : "";
    if (!token || token.length < 10) throw DomainError.validation("A valid invitation token is required");
    const result = await app.container.handlers.acceptInvitation.preview(token);
    if (!result.ok) throw result.error;
    return reply.status(200).send(InvitationPreviewSchema.parse(result.value));
  });

  app.post("/v1/invitations/accept", async (req) => {
    const body = AcceptInvitationSchema.parse(req.body);
    const result = await app.container.handlers.acceptInvitation.handle({
      token: body.token,
      name: body.name,
      password: body.password,
    });
    if (!result.ok) throw result.error;
    return AcceptInvitationResponseSchema.parse({ token: result.value.token, userId: result.value.userId, tenantId: result.value.tenantId, role: result.value.role });
  });
}
