import { BUILT_IN_PACKS, type DefaultPack, type TenantId } from "@donordesk/domain";
import type { IDefaultPackSource, ISetupPackRepository } from "@donordesk/application";

/**
 * The packs the wizard may use: those that ship with DonorDesk plus the organisation's own. `resolvePack` already prefers the
 * organisation's pack for a sector over the built-in one. A pack that cannot be read (a failed read, or a row that is not a pack)
 * is skipped, so a bad row can never stop a project being created: the built-in pack applies instead.
 */
export class OrganisationPackSource implements IDefaultPackSource {
  constructor(private readonly own: ISetupPackRepository) {}

  async list(tenantId: TenantId): Promise<DefaultPack[]> {
    const stored = await this.own.list(tenantId);
    const mine = stored.ok ? stored.value.map((s) => s.pack).filter((p) => p && typeof p === "object" && p.source === "ORGANISATION" && Array.isArray(p.reportRules) && Array.isArray(p.risks)) : [];
    return [...BUILT_IN_PACKS, ...mine];
  }
}
