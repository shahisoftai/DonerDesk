import type { FastifyRequest, FastifyReply } from "fastify";
import { MFA_SETUP_REQUIRED_CODE, TenantId, isAllowedBeforeMfaSetup, mfaGate } from "@donordesk/domain";

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.status(401).send({ type: "https://donordesk/problems/unauthorized", title: "Missing bearer token", status: 401 });
  }
  const token = auth.slice(7);
  const user = await req.server.container.auth.verify(token);
  if (!user) {
    return reply.status(401).send({ type: "https://donordesk/problems/unauthorized", title: "Invalid token", status: 401 });
  }
  req.tenant = {
    tenantId: TenantId.create(user.tenantId.toString()),
    userId: user.userId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  if (typeof user.iat === "number") {
    try {
      const row = await req.server.container.prisma.user.findFirst({
        where: { id: user.userId, tenantId: user.tenantId.toString() },
        select: { passwordChangedAt: true, role: true, status: true, external: true, mfaSecretEnc: true, mfaEnabledAt: true },
      });
      // The token only proves who signed in. What the person may do is what the directory says now: a demoted,
      // suspended or removed user loses access on the next request, not when the 7-day token expires.
      if (row && (row.status === "SUSPENDED" || row.status === "REMOVED")) {
        return reply.status(401).send({
          type: "https://donordesk/problems/unauthorized",
          title: "This account is no longer active",
          status: 401,
          code: "ACCOUNT_INACTIVE",
        });
      }
      if (row?.role) req.tenant.role = row.role as typeof req.tenant.role;
      if (row?.external) req.tenant.external = true;
      // When the organisation requires two-step sign-in and this person has not set it up, they can do one thing: set it up.
      if (row && process.env.AUTH_PROVIDER !== "oidc") {
        const org = await req.server.container.prisma.organization.findFirst({ where: { tenantId: user.tenantId.toString() }, select: { mfaRequiredFrom: true } });
        const gate = mfaGate({ requiredFrom: org?.mfaRequiredFrom, now: new Date(), userHasMfa: Boolean(row.mfaSecretEnc && row.mfaEnabledAt), ssoManaged: false });
        if (gate === "SETUP_REQUIRED" && !isAllowedBeforeMfaSetup(req.url)) {
          return reply.status(403).send({
            type: "https://donordesk/problems/forbidden",
            title: "Set up two-step sign-in to continue. Your organization requires it.",
            status: 403,
            code: MFA_SETUP_REQUIRED_CODE,
          });
        }
      }
      if (row?.passwordChangedAt) {
        const floorSeconds = Math.floor(row.passwordChangedAt.getTime() / 1000);
        if (user.iat < floorSeconds) {
          return reply.status(401).send({
            type: "https://donordesk/problems/unauthorized",
            title: "Password changed; please sign in again",
            status: 401,
            code: "PASSWORD_RESET",
          });
        }
      }
    } catch {
      // Fall through; never block auth on transient DB issues.
    }
  }
}
