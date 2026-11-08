import type { LibraryIndicator, Result } from "@donordesk/domain";
import { BUILT_IN_INDICATORS, DomainError, checkAddedEntry, checkOverride } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IOrganisationLibraryStore } from "../../ports/sector-library.js";

export type SaveEntryInput =
  | { kind: "ADDED"; entry: unknown }
  | { kind: "OVERRIDE"; entryId: string; patch: unknown }
  | { kind: "CLEAR"; entryId: string };

/**
 * An organisation adds its own indicator to the library, rewords a built-in one, or goes back to the library's wording. The rules
 * that decide whether it is allowed are the domain's (`checkAddedEntry`, `checkOverride`); a refusal is a sentence. The built-in
 * library is never edited.
 */
export class SaveOrganisationEntryHandler {
  constructor(private readonly store: IOrganisationLibraryStore, private readonly audit: IAuditLogger, private readonly builtIn: readonly LibraryIndicator[] = BUILT_IN_INDICATORS) {}

  async handle(ctx: AuthenticatedContext, input: SaveEntryInput): Promise<Result<{ entryId: string }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const done = async (entryId: string, what: string): Promise<Result<{ entryId: string }, DomainError>> => {
      await this.audit.record({ tenantId, actorId: ctx.tenant.userId, eventType: `sector_library.${what}`, entityType: "library_entry", entityId: entryId, newValue: entryId });
      return { ok: true, value: { entryId } };
    };
    if (input.kind === "ADDED") {
      const checked = checkAddedEntry(input.entry);
      if (!checked.ok) return { ok: false, error: DomainError.validation(checked.reason) };
      if (this.builtIn.some((e) => e.id === checked.entry.id)) return { ok: false, error: DomainError.validation("That id belongs to the library.") };
      const saved = await this.store.upsert(tenantId, { entryId: checked.entry.id, kind: "ADDED", payload: checked.entry, libraryVersion: null, updatedById: ctx.tenant.userId });
      return saved.ok ? done(checked.entry.id, "entry_added") : saved;
    }
    if (input.kind === "OVERRIDE") {
      const base = this.builtIn.find((e) => e.id === input.entryId);
      if (!base) return { ok: false, error: DomainError.notFound("Library indicator", input.entryId) };
      const checked = checkOverride(base, input.patch);
      if (!checked.ok) return { ok: false, error: DomainError.validation(checked.reason) };
      const saved = await this.store.upsert(tenantId, { entryId: base.id, kind: "OVERRIDE", payload: input.patch, libraryVersion: base.version, updatedById: ctx.tenant.userId });
      return saved.ok ? done(base.id, "entry_reworded") : saved;
    }
    const isBuiltIn = this.builtIn.some((e) => e.id === input.entryId);
    const removed = await this.store.remove(tenantId, input.entryId, isBuiltIn ? "OVERRIDE" : "ADDED");
    return removed.ok ? done(input.entryId, isBuiltIn ? "entry_restored" : "entry_removed") : removed;
  }
}
