import { DomainError, draftExpiresOn, draftNeedsReminder, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { ICollectionDraftRepository } from "../../ports/collection.js";
import { can, fail, ok, placeKeyOf } from "./assessment-common.js";
import { toDraftDto, type DraftDto } from "./save-collection-draft.js";

/** The person's own draft of a form for a facility, or nothing. Nobody reads another person's draft. */
export class GetCollectionDraftHandler {
  constructor(private readonly drafts: Pick<ICollectionDraftRepository, "find">) {}

  async handle(ctx: AuthenticatedContext, formId: string, placeId?: string): Promise<Result<DraftDto | null, DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    const found = await this.drafts.find(formId, ctx.tenant.userId, placeKeyOf(placeId), ctx.tenant.tenantId);
    if (!found.ok) return found;
    return ok(found.value ? toDraftDto(found.value) : null);
  }
}

export interface MyDraftDto extends DraftDto { expiresOn: string; remind: boolean }

/** The person's drafts with the day each expires, so the screen can say "finish by". */
export class ListMyCollectionDraftsHandler {
  constructor(private readonly drafts: Pick<ICollectionDraftRepository, "listForUser">, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<MyDraftDto[], DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    const listed = await this.drafts.listForUser(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    return ok(listed.value.map((d) => ({ ...toDraftDto(d), expiresOn: draftExpiresOn(d.updatedAt).toISOString().slice(0, 10), remind: draftNeedsReminder(d.updatedAt, now) })));
  }
}
