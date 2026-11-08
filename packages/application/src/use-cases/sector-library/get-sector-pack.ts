import type { LibrarySectorId, PackPart, Result } from "@donordesk/domain";
import { BUILT_IN_CONTENT, DomainError, LIBRARY_SECTOR_IDS, SECTOR_REGISTRY, packOf } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";

export interface SectorPackView { sectorId: LibrarySectorId; label: string; summary: string; attached: boolean; projectSector: string; parts: PackPart[] }

/** One sector's whole pack: every part with its items, or the reason it is empty. The wizard and the project pages read it. */
export class GetSectorPackHandler {
  async handle(_ctx: AuthenticatedContext, sectorId: string): Promise<Result<SectorPackView, DomainError>> {
    if (!(LIBRARY_SECTOR_IDS as readonly string[]).includes(sectorId)) return { ok: false, error: DomainError.notFound("Sector", sectorId) };
    const id = sectorId as LibrarySectorId;
    const def = SECTOR_REGISTRY[id];
    const content = BUILT_IN_CONTENT[id];
    return { ok: true, value: { sectorId: id, label: def.label, summary: content.summary, attached: def.attached, projectSector: def.projectSector, parts: packOf(content) } };
  }
}
