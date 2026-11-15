import { ok, type DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasSubscriptionRepository } from "../../ports/canvas-subscriptions.js";
import { subscriptionDto, type CanvasSubscriptionDto } from "./canvas-subscription-dto.js";

/** The caller's own subscriptions (Phase 48.16). */
export class ListMyCanvasSubscriptionsHandler {
  constructor(private readonly repo: ICanvasSubscriptionRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ subscriptions: CanvasSubscriptionDto[] }, DomainError>> {
    const r = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    return r.ok ? ok({ subscriptions: r.value.map(subscriptionDto) }) : r;
  }
}
