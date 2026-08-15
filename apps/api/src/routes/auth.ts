import type { FastifyInstance } from "fastify";
import { SignUpSchema, LoginSchema, GoogleSignInSchema } from "@donordesk/contracts";
import { DomainError } from "@donordesk/domain";
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
  });}
