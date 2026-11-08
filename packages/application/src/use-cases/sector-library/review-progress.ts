import type { LibraryReviewStatus, LibrarySectorId, Result } from "@donordesk/domain";
import { DomainError, LIBRARY_SECTOR_IDS, SECTOR_REGISTRY, effectiveReview } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";

export interface SectorReviewProgress { sectorId: LibrarySectorId; label: string; total: number; byStatus: Record<LibraryReviewStatus, number>; verifiedStandards: number; standards: number }

/** How far review has got, per sector: the count in each state, and how many reference standards have been checked against their source. */
export class GetLibraryReviewProgressHandler {
  constructor(private readonly library: EffectiveLibraryService) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ sectors: SectorReviewProgress[]; total: number; reviewed: number }, DomainError>> {
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const sectors: SectorReviewProgress[] = LIBRARY_SECTOR_IDS.map((id) => ({ sectorId: id, label: SECTOR_REGISTRY[id].label, total: 0, byStatus: { UNREVIEWED: 0, IN_REVIEW: 0, REVIEWED: 0, DEPRECATED: 0 }, verifiedStandards: 0, standards: 0 }));
    const by = new Map(sectors.map((s) => [s.sectorId, s] as const));
    for (const e of lib.value.entries) {
      const s = by.get(e.sectorId);
      if (!s) continue;
      s.total += 1;
      s.byStatus[effectiveReview(e, lib.value.decisions.get(e.id)).status] += 1;
      if (e.referenceStandard) { s.standards += 1; if (e.referenceStandard.verified) s.verifiedStandards += 1; }
    }
    return { ok: true, value: { sectors, total: sectors.reduce((n, s) => n + s.total, 0), reviewed: sectors.reduce((n, s) => n + s.byStatus.REVIEWED, 0) } };
  }
}
