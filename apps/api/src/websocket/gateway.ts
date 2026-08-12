/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TenantId, Role } from "@donordesk/domain";

export interface AuthenticatedUser {
  userId: string;
  tenantId: TenantId;
  role: Role;
  email: string;
  name: string;
}

export interface WsMessage {
  type: string;
  channel?: string;
  payload?: Record<string, unknown>;
  userId?: string;
  timestamp?: string;
}

export interface CollaborationChannel {
  id: string;
  type: "report_section" | "indicator_update" | "activity";
  reportingPeriodId: string;
  participants: Set<string>;
}

const CHANNEL_TTL_MS = 4 * 60 * 60 * 1000;

type WsSocket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
};

export class CollaborationGateway {
  private readonly channels: Map<string, CollaborationChannel> = new Map();
  private readonly userSockets: Map<string, Set<WsSocket>> = new Map();
  private readonly socketUsers: Map<WsSocket, AuthenticatedUser> = new Map();
  private gcInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly verifyToken: (token: string) => Promise<AuthenticatedUser | null>) {}

  private userKey(user: Pick<AuthenticatedUser, "tenantId" | "userId">): string {
    return `${user.tenantId.toString()}:${user.userId}`;
  }

  private channelKey(tenantId: TenantId, channelId: string): string {
    return `${tenantId.toString()}:${channelId}`;
  }

  async handleConnection(socket: WsSocket, params: { token?: string }): Promise<{ user: AuthenticatedUser; channels: string[] } | { error: string; code: number }> {
    if (!params.token) {
      return { error: "Authentication required", code: 401 };
    }
    const user = await this.verifyToken(params.token);
    if (!user) {
      return { error: "Invalid or expired token", code: 401 };
    }
    this.socketUsers.set(socket, user);
    const userKey = this.userKey(user);
    const userSockets = this.userSockets.get(userKey) ?? new Set();
    userSockets.add(socket);
    this.userSockets.set(userKey, userSockets);
    return { user, channels: [] };
  }

  handleDisconnect(socket: WsSocket): void {
    const user = this.socketUsers.get(socket);
    if (user) {
      const userKey = this.userKey(user);
      const userSockets = this.userSockets.get(userKey);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          this.userSockets.delete(userKey);
          this.removeUserFromAllChannels(user);
        }
      }
      this.socketUsers.delete(socket);
    }
  }

  async handleMessage(socket: WsSocket, rawData: unknown): Promise<WsMessage | null> {
    const user = this.socketUsers.get(socket);
    if (!user) return null;

    let msg: WsMessage;
    try {
      const serialized = typeof rawData === "string" ? rawData : JSON.stringify(rawData);
      if (Buffer.byteLength(serialized, "utf8") > 64 * 1024) return null;
      msg = typeof rawData === "string" ? JSON.parse(rawData) : (rawData as WsMessage);
    } catch {
      return null;
    }
    if (!msg || typeof msg.type !== "string") return null;
    if (msg.channel && !/^[A-Za-z0-9:_-]{1,160}$/.test(msg.channel)) return null;

    switch (msg.type) {
      case "join_channel": {
        const channelId = msg.channel;
        if (channelId) {
          this.joinChannel(channelId, user);
          this.broadcastToChannel(user.tenantId, channelId, {
            type: "user_joined",
            channel: channelId,
            payload: { userId: user.userId, name: user.name },
            timestamp: new Date().toISOString(),
          }, user.userId);
        }
        break;
      }
      case "leave_channel": {
        const channelId = msg.channel;
        if (channelId) {
          this.leaveChannel(channelId, user);
          this.broadcastToChannel(user.tenantId, channelId, {
            type: "user_left",
            channel: channelId,
            payload: { userId: user.userId },
            timestamp: new Date().toISOString(),
          }, user.userId);
        }
        break;
      }
      case "cursor_move":
      case "content_edit":
      case "comment_add": {
        if (!msg.channel || !this.isChannelMember(msg.channel, user)) return null;
        this.broadcastToChannel(user.tenantId, msg.channel, {
          type: msg.type,
          channel: msg.channel,
          payload: msg.payload ? { ...msg.payload, userId: user.userId } : { userId: user.userId },
          userId: user.userId,
          timestamp: new Date().toISOString(),
        }, user.userId);
        break;
      }
      default:
        return null;
    }
    return msg;
  }

  private joinChannel(channelId: string, user: AuthenticatedUser): void {
    const key = this.channelKey(user.tenantId, channelId);
    const existing = this.channels.get(key);
    if (existing) {
      existing.participants.add(user.userId);
    } else {
      this.channels.set(key, {
        id: channelId,
        type: "report_section",
        reportingPeriodId: channelId.split(":")[0] ?? "",
        participants: new Set([user.userId]),
      });
    }
  }

  private leaveChannel(channelId: string, user: AuthenticatedUser): void {
    const key = this.channelKey(user.tenantId, channelId);
    const channel = this.channels.get(key);
    if (channel) {
      channel.participants.delete(user.userId);
      if (channel.participants.size === 0) {
        this.channels.delete(key);
      }
    }
  }

  private removeUserFromAllChannels(user: AuthenticatedUser): void {
    const tenantPrefix = `${user.tenantId.toString()}:`;
    for (const [key, channel] of this.channels) {
      if (!key.startsWith(tenantPrefix)) continue;
      channel.participants.delete(user.userId);
      if (channel.participants.size === 0) {
        this.channels.delete(key);
      } else {
        this.broadcastToChannel(user.tenantId, channel.id, {
          type: "user_left",
          channel: channel.id,
          payload: { userId: user.userId },
          timestamp: new Date().toISOString(),
        }, user.userId);
      }
    }
  }

  private isChannelMember(channelId: string, user: AuthenticatedUser): boolean {
    return this.channels.get(this.channelKey(user.tenantId, channelId))?.participants.has(user.userId) ?? false;
  }

  broadcastToChannel(tenantId: TenantId, channelId: string, message: WsMessage, excludeUserId?: string): void {
    const channel = this.channels.get(this.channelKey(tenantId, channelId));
    if (!channel) return;
    const payload = JSON.stringify(message);
    for (const participantId of channel.participants) {
      if (participantId === excludeUserId) continue;
      const sockets = this.userSockets.get(`${tenantId.toString()}:${participantId}`);
      if (sockets) {
        for (const socket of sockets) {
          try {
            socket.send(payload);
          } catch { /* socket may be closed */ }
        }
      }
    }
  }

  sendToUser(tenantId: string, userId: string, message: WsMessage): void {
    const sockets = this.userSockets.get(`${tenantId}:${userId}`);
    if (sockets) {
      const payload = JSON.stringify(message);
      for (const socket of sockets) {
        try {
          socket.send(payload);
        } catch { /* socket may be closed */ }
      }
    }
  }

  notifyEvent(userId: string, tenantId: string, event: { type: string; title: string; message: string; entityType?: string; entityId?: string }): void {
    this.sendToUser(tenantId, userId, {
      type: "notification",
      payload: { ...event, tenantId: tenantId.toString() },
      timestamp: new Date().toISOString(),
    });
  }

  getChannelParticipants(tenantId: TenantId, channelId: string): string[] {
    return Array.from(this.channels.get(this.channelKey(tenantId, channelId))?.participants ?? []);
  }

  startGcLoop(): void {
    if (this.gcInterval) return;
    this.gcInterval = setInterval(() => {
      for (const [channelId, channel] of this.channels) {
        if (channel.participants.size === 0) {
          this.channels.delete(channelId);
        }
      }
    }, CHANNEL_TTL_MS);
  }

  stopGcLoop(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }
}

export function createCollaborationGateway(verifyToken: (token: string) => Promise<AuthenticatedUser | null>): CollaborationGateway {
  return new CollaborationGateway(verifyToken);
}
