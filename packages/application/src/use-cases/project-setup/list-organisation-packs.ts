import type { DefaultPack, Result } from "@donordesk/domain";
import { BUILT_IN_PACKS, SECTOR_TEMPLATES, DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ISetupPackRepository } from "../../ports/project-setup.js";

export interface OrganisationPacksView {
  /** The organisation's own packs. */
  own: Array<{ sectorKey: string; pack: DefaultPack; updatedAt: string }>;
  /** What ships with DonorDesk, so the screen can show what a sector gets when the organisation has not written its own. */
  builtIn: DefaultPack[];
  /** The starting dashboards a pack may name. */
  dashboards: Array<{ id: string; title: string; sector: string }>;
}

/** The organisation's default packs beside the built-in ones (Settings). Administrators only: it is where they are written. */
export class ListOrganisationPacksHandler {
  constructor(private readonly packs: ISetupPackRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<OrganisationPacksView, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("Only an administrator can manage default packs") };
    const stored = await this.packs.list(ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    return { ok: true, value: { own: stored.value.map((s) => ({ sectorKey: s.sectorKey, pack: s.pack, updatedAt: s.updatedAt.toISOString() })), builtIn: [...BUILT_IN_PACKS], dashboards: SECTOR_TEMPLATES.map((t) => ({ id: t.id, title: t.title, sector: String(t.sector) })) } };
  }
}
