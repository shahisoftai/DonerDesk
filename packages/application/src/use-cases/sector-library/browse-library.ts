import type { LibraryIndicator, LibraryIndicatorKind, LibraryLevel, LibrarySectorId, LibrarySourceId, Result, SectorDef } from "@donordesk/domain";
import { DomainError, LIBRARY_SECTOR_IDS, LIBRARY_CONTENT_VERSION, SECTOR_REGISTRY, countBySector, describeStandard, effectiveReview, groupEntries, searchLibrary } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";

export interface BrowseLibraryInput {
  projectId?: string | undefined;
  sectors?: readonly LibrarySectorId[] | undefined;
  text?: string | undefined;
  sources?: readonly LibrarySourceId[] | undefined;
  levels?: readonly LibraryLevel[] | undefined;
  kinds?: readonly LibraryIndicatorKind[] | undefined;
  reviewedOnly?: boolean | undefined;
  recommendedOnly?: boolean | undefined;
  withStandard?: boolean | undefined;
  /** Include entries already in the project (shown as adopted instead of left out). */
  includeAdopted?: boolean | undefined;
  limit?: number | undefined;
}

export interface LibraryEntryView extends LibraryIndicator {
  review: LibraryIndicator["review"];
  standardText: string | null;
  adopted: boolean;
  origin: "LIBRARY" | "ORGANISATION";
  reworded: boolean;
}

export interface SectorSummary { id: LibrarySectorId; label: string; group: SectorDef["group"]; attached: boolean; count: number }

export interface BrowseLibraryResult {
  libraryVersion: string;
  sectors: SectorSummary[];
  total: number;
  groups: Array<{ group: string; entries: LibraryEntryView[] }>;
  adoptedIds: string[];
  /** Organisation records that were skipped because they no longer pass the checks. */
  skipped: Array<{ entryId: string; reason: string }>;
}

const MAX = 400;

/** What the picker shows: sectors with counts, then the entries that match, grouped by standard, with the review state this organisation sees. */
export class BrowseSectorLibraryHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, input: BrowseLibraryInput): Promise<Result<BrowseLibraryResult, DomainError>> {
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const adopted = new Set<string>();
    if (input.projectId) {
      const list = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
      if (!list.ok) return list;
      for (const i of list.value) if (i.libraryId) adopted.add(i.libraryId);
    }
    const reviewOf = (e: LibraryIndicator) => effectiveReview(e, lib.value.decisions.get(e.id)).status;
    const matched = searchLibrary(lib.value.entries, {
      ...(input.sectors?.length ? { sectors: input.sectors } : {}), ...(input.text ? { text: input.text } : {}), ...(input.sources?.length ? { sources: input.sources } : {}),
      ...(input.levels?.length ? { levels: input.levels } : {}), ...(input.kinds?.length ? { kinds: input.kinds } : {}),
      ...(input.reviewedOnly ? { reviewed: "REVIEWED_ONLY" as const } : {}), ...(input.recommendedOnly ? { recommendedOnly: true } : {}),
      ...(input.withStandard ? { withStandard: true } : {}), ...(!input.includeAdopted && adopted.size > 0 ? { exclude: adopted } : {}),
    }, reviewOf);
    const views: LibraryEntryView[] = matched.slice(0, input.limit ?? MAX).map((e) => ({
      ...e, review: effectiveReview(e, lib.value.decisions.get(e.id)), standardText: e.referenceStandard ? describeStandard(e.referenceStandard) : null,
      adopted: adopted.has(e.id), origin: lib.value.added.has(e.id) ? "ORGANISATION" : "LIBRARY", reworded: lib.value.overridden.has(e.id),
    }));
    const counts = countBySector(lib.value.entries);
    const sectors: SectorSummary[] = LIBRARY_SECTOR_IDS.map((id) => ({ id, label: SECTOR_REGISTRY[id].label, group: SECTOR_REGISTRY[id].group, attached: SECTOR_REGISTRY[id].attached, count: counts.get(id) ?? 0 }));
    const byId = new Map(views.map((v) => [v.id, v] as const));
    const groups = groupEntries(views).map((g) => ({ group: g.group, entries: g.entries.map((e) => byId.get(e.id)!) }));
    return { ok: true, value: { libraryVersion: LIBRARY_CONTENT_VERSION, sectors, total: matched.length, groups, adoptedIds: [...adopted], skipped: lib.value.skipped.map(({ entryId, reason }) => ({ entryId, reason })) } };
  }
}
