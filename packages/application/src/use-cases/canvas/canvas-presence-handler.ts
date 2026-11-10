import { DomainError, err, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { InMemoryPresence, PresenceEntry } from "../../services/canvas-presence.js";
import type { GetCanvasHandler } from "./get-canvas.js";

/** One person's open connection to a canvas's presence: what they see of others, and how they say what they are doing. */
export interface PresenceSession {
  others(): PresenceEntry[];
  subscribe(listener: () => void): () => void;
  update(change: { blockId: string | null; editing: boolean }): void;
  /** Refreshes the person's own entry (a heartbeat). */
  touch(): void;
  close(): void;
}

/**
 * Presence on a canvas (Phase 48.8). A person may join only a canvas they can see (the ordinary read decides, so a personal canvas of
 * someone else does not exist for them), and they see only who else is there, never what anyone is changing.
 */
export class CanvasPresenceHandler {
  private readonly names = new Map<string, string>();
  constructor(private readonly presence: InMemoryPresence, private readonly canvases: GetCanvasHandler, private readonly users: IUserRepository) {}

  async open(ctx: AuthenticatedContext, canvasId: string): Promise<Result<PresenceSession, DomainError>> {
    const seen = await this.canvases.handle(ctx, canvasId);
    if (!seen.ok) return seen;
    const userId = ctx.tenant.userId;
    const room = `${ctx.tenant.tenantId.toString()}:${canvasId}`;
    const name = await this.nameOf(ctx);
    let state = { blockId: null as string | null, editing: false };
    const say = () => this.presence.touch(room, { userId, name, ...state });
    say();
    return ok({
      others: () => this.presence.others(room, userId),
      subscribe: (l) => this.presence.subscribe(room, l),
      update: (change) => { state = change; say(); },
      touch: say,
      close: () => this.presence.leave(room, userId),
    });
  }

  /** Says what the caller is doing without holding a connection (the page sends this when the selection changes). */
  async update(ctx: AuthenticatedContext, canvasId: string, change: { blockId: string | null; editing: boolean }): Promise<Result<void, DomainError>> {
    const seen = await this.canvases.handle(ctx, canvasId);
    if (!seen.ok) return err(seen.error);
    this.presence.touch(`${ctx.tenant.tenantId.toString()}:${canvasId}`, { userId: ctx.tenant.userId, name: await this.nameOf(ctx), ...change });
    return ok(undefined);
  }

  private async nameOf(ctx: AuthenticatedContext): Promise<string> {
    const cached = this.names.get(ctx.tenant.userId);
    if (cached) return cached;
    const found = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    const name = found.ok && found.value ? found.value.name : "Someone";
    this.names.set(ctx.tenant.userId, name);
    return name;
  }
}
