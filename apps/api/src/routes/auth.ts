import type { FastifyInstance } from "fastify";
import { SignUpSchema, LoginSchema, GoogleSignInSchema, ChangePasswordSchema, RequestPasswordResetSchema, ConfirmPasswordResetSchema, PasswordResetValidationResponseSchema, PasswordResetAcceptedResponseSchema } from "@donordesk/contracts";
import { DomainError, PasswordResetToken } from "@donordesk/domain";
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

  app.post("/v1/auth/google", async (req) => {
    if (process.env.AUTH_PROVIDER === "oidc") throw DomainError.forbidden("Google Sign-In is disabled when OIDC is enabled");
    const body = GoogleSignInSchema.parse(req.body);
    const result = await app.container.handlers.googleSignIn.handle(body);
    if (!result.ok) throw result.error;
    return result.value;
  });

  app.post("/v1/auth/password/change", { preHandler: authMiddleware }, async (req, reply) => {
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
}
