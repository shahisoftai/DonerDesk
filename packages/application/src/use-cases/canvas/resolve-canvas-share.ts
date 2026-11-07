import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { ICanvasShareLinkRepository } from "../../ports/canvas.js";
import type { IClock } from "../../ports/core.js";
import { fail, ok } from "./canvas-shared.js";
import { sha256 } from "./canvas-share-links.js";

/** A token to its link: expired, revoked and unknown tokens all answer the same "not available". */
export class ResolveCanvasShareHandler {
  constructor(private readonly links: ICanvasShareLinkRepository, private readonly clock: IClock) {}
  async handle(token: string): Promise<Result<{ tenantId: TenantId; canvasId: string; kind: "LIVE" | "FROZEN"; exportId?: string }, DomainError>> {
    const found = await this.links.findByTokenHash(sha256(token));
    if (!found.ok) return found;
    const l = found.value;
    if (!l || l.revokedAt || l.expiresAt <= this.clock.now()) return fail(DomainError.notFound("Link", "unavailable"));
    return ok({ tenantId: l.tenantId, canvasId: l.canvasId, kind: l.kind, ...(l.exportId ? { exportId: l.exportId } : {}) });
  }
}
