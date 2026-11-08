import type { LibraryIndicator, Result } from "@donordesk/domain";
import { BUILT_IN_INDICATORS, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IOrganisationLibraryStore } from "../../ports/sector-library.js";

/** Hides a built-in entry from the organisation's picker, or shows it again. Projects that already copied it keep it. */
export class SetLibraryEntryHiddenHandler {
  constructor(private readonly store: IOrganisationLibraryStore, private readonly audit: IAuditLogger, private readonly builtIn: readonly LibraryIndicator[] = BUILT_IN_INDICATORS) {}

  async handle(ctx: AuthenticatedContext, input: { entryId: string; hidden: boolean }): Promise<Result<{ entryId: string; hidden: boolean }, DomainError>> {
    if (!this.builtIn.some((e) => e.id === input.entryId)) return { ok: false, error: DomainError.notFound("Library indicator", input.entryId) };
    const r = input.hidden
      ? await this.store.upsert(ctx.tenant.tenantId, { entryId: input.entryId, kind: "HIDDEN", payload: true, libraryVersion: null, updatedById: ctx.tenant.userId })
      : await this.store.remove(ctx.tenant.tenantId, input.entryId, "HIDDEN");
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: input.hidden ? "sector_library.entry_hidden" : "sector_library.entry_shown", entityType: "library_entry", entityId: input.entryId, newValue: String(input.hidden) });
    return { ok: true, value: { entryId: input.entryId, hidden: input.hidden } };
  }
}
