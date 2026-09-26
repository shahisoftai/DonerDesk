import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantId } from "@donordesk/domain";

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
        select: { passwordChangedAt: true },
      });
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
