import { DomainError, checkDraftSave, type Result } from "@donordesk/domain";
import type { SaveDraftInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock, IIdGenerator } from "../../ports/core.js";
import type { ICollectionDraftRepository, ICollectionFormRepository } from "../../ports/collection.js";
import { can, fail, loadForm, ok, placeKeyOf } from "./assessment-common.js";

export interface DraftDto { id: string; formId: string; placeId?: string; answers: Record<string, unknown>; how?: Record<string, string>; startedAt: string; updatedAt: string }

/**
 * Saves a long form in progress (Phase 62.4). One draft per person, form and facility. The save quotes the version it started from, so an
 * old phone cannot overwrite a newer copy; the answers are not validated here (a draft may be half done) but their size is limited.
 */
export class SaveCollectionDraftHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: Pick<ICollectionFormRepository, "findById">, private readonly drafts: ICollectionDraftRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: SaveDraftInput): Promise<Result<DraftDto, DomainError>> {
    if (!can(ctx, "collection.submit")) return fail(DomainError.forbidden("You cannot fill forms"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (form.value.status !== "PUBLISHED") return fail(DomainError.conflict("This form is not open for answers."));
    const key = placeKeyOf(input.placeId);
    const stored = await this.drafts.find(formId, ctx.tenant.userId, key, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    const bytes = JSON.stringify(input.answers).length + JSON.stringify(input.how ?? {}).length;
    const checked = checkDraftSave(stored.value ?? undefined, input.expectedUpdatedAt, bytes);
    if (!checked.ok) return fail(checked.refusal === "CONFLICT" ? DomainError.conflict("This draft was saved somewhere else since you opened it. Reload it to keep both sets of changes.") : DomainError.validation("This draft is too large to save."));
    const now = this.clock.now();
    const saved = await this.drafts.save({
      id: stored.value?.id ?? this.ids.generate(), tenantId: ctx.tenant.tenantId, formId, projectId: form.value.projectId, userId: ctx.tenant.userId, placeKey: key,
      answers: input.answers, ...(input.how ? { how: input.how } : {}), startedAt: stored.value?.startedAt ?? (input.startedAt ? new Date(input.startedAt) : now), createdAt: stored.value?.createdAt ?? now, updatedAt: now,
    });
    if (!saved.ok) return saved;
    return ok(toDraftDto(saved.value));
  }
}

export function toDraftDto(d: { id: string; formId: string; placeKey: string; answers: Record<string, unknown>; how?: Record<string, string> | undefined; startedAt: Date; updatedAt: Date }): DraftDto {
  return { id: d.id, formId: d.formId, ...(d.placeKey ? { placeId: d.placeKey } : {}), answers: d.answers, ...(d.how ? { how: d.how } : {}), startedAt: d.startedAt.toISOString(), updatedAt: d.updatedAt.toISOString() };
}
