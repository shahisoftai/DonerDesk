import type { EffectiveLibrary, LibraryIndicator, Result, TenantId } from "@donordesk/domain";
import { BUILT_IN_INDICATORS, applyOrganisationEntries } from "@donordesk/domain";
import type { IOrganisationLibraryStore } from "../ports/sector-library.js";

/**
 * The library as one organisation sees it: the built-in entries with the organisation's own additions, rewordings, hidden entries
 * and review decisions laid over them (the rules are `applyOrganisationEntries`). Reading the library never fails because an
 * organisation record is bad: bad records are skipped and listed.
 */
export class EffectiveLibraryService {
  constructor(private readonly store: IOrganisationLibraryStore, private readonly builtIn: readonly LibraryIndicator[] = BUILT_IN_INDICATORS) {}

  async forTenant(tenantId: TenantId): Promise<Result<EffectiveLibrary & { byId: ReadonlyMap<string, LibraryIndicator> }>> {
    const records = await this.store.list(tenantId);
    if (!records.ok) return records;
    const lib = applyOrganisationEntries(this.builtIn, records.value.map((r) => ({ entryId: r.entryId, kind: r.kind, payload: r.payload, libraryVersion: r.libraryVersion })));
    return { ok: true, value: { ...lib, byId: new Map(lib.entries.map((e) => [e.id, e])) } };
  }
}
