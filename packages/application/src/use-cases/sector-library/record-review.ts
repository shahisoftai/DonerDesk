import type { LibraryReviewStatus, Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";
import type { IOrganisationLibraryStore } from "../../ports/sector-library.js";

export interface RecordReviewInput { entryIds: readonly string[]; status: Exclude<LibraryReviewStatus, "DEPRECATED">; reviewer: string; note?: string | undefined }

/** The organisation records that it reviewed (or is reviewing) entries. A decision belongs to the version seen; a newer version reads unreviewed again. */
export class RecordLibraryReviewHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly store: IOrganisationLibraryStore, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: RecordReviewInput): Promise<Result<{ recorded: number }, DomainError>> {
    const reviewer = input.reviewer.trim();
    if (input.entryIds.length === 0 || input.entryIds.length > 500) return { ok: false, error: DomainError.validation("Choose between 1 and 500 indicators.") };
    if (input.status === "REVIEWED" && !reviewer) return { ok: false, error: DomainError.validation("Say who reviewed it.") };
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const today = this.clock.now().toISOString().slice(0, 10);
    let recorded = 0;
    for (const id of input.entryIds) {
      const entry = lib.value.byId.get(id);
      if (!entry) continue;
      if (input.status === "UNREVIEWED") { await this.store.remove(ctx.tenant.tenantId, id, "REVIEW"); recorded += 1; continue; }
      const r = await this.store.upsert(ctx.tenant.tenantId, { entryId: id, kind: "REVIEW", payload: { entryId: id, version: entry.version, status: input.status, reviewer: reviewer || ctx.tenant.userId, reviewedOn: today, ...(input.note ? { note: input.note.slice(0, 500) } : {}) }, libraryVersion: entry.version, updatedById: ctx.tenant.userId });
      if (!r.ok) return r;
      recorded += 1;
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.review_recorded", entityType: "library", entityId: "library", newValue: `${recorded} ${input.status}` });
    return { ok: true, value: { recorded } };
  }
}
