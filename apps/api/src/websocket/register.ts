import type { FastifyInstance, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import { TenantId } from "@donordesk/domain";
import { createCollaborationGateway } from "./gateway.js";

function bearerToken(req: FastifyRequest): string | undefined {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const protocols = req.headers["sec-websocket-protocol"]?.split(",").map((value) => value.trim());
  const bearerIndex = protocols?.indexOf("bearer") ?? -1;
  return bearerIndex >= 0 ? protocols?.[bearerIndex + 1] : undefined;
}

export async function registerCollaborationWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });
  const gateway = createCollaborationGateway(async (token) => {
    const user = await app.container.auth.verify(token);
    return user ? { ...user, tenantId: TenantId.create(user.tenantId.toString()) } : null;
  });
  gateway.startGcLoop();
  app.addHook("onClose", async () => gateway.stopGcLoop());

  app.get("/v1/collaboration", { websocket: true }, async (socket, req) => {
    const connected = await gateway.handleConnection(socket, { token: bearerToken(req) });
    if ("error" in connected) {
      socket.close(1008, connected.error);
      return;
    }
    socket.on("message", (data: { toString(): string }) => void gateway.handleMessage(socket, data.toString()));
    socket.on("close", () => gateway.handleDisconnect(socket));
  });
}
