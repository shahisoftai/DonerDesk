import type { LibraryUpdateState, Result } from "@donordesk/domain";
import { DomainError, diffVersions, parseLink } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";

export interface IndicatorUpdateStatus { indicatorId: string; code: string; name: string; libraryId: string; update: LibraryUpdateState }

/** For each indicator a project copied from the library: has the entry moved on? Reading only; nothing is changed by comparing. */
export class CheckLibraryUpdatesHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<IndicatorUpdateStatus[], DomainError>> {
    const list = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!list.ok) return list;
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const out: IndicatorUpdateStatus[] = [];
    for (const i of list.value) {
      const link = parseLink(i.libraryJson);
      if (!i.libraryId || !link) continue;
      out.push({ indicatorId: i.id, code: i.code, name: i.name, libraryId: i.libraryId, update: diffVersions(link, lib.value.byId.get(i.libraryId), (id) => lib.value.byId.get(id)) });
    }
    return { ok: true, value: out };
  }
}
