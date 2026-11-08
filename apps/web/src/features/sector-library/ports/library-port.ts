/**
 * What the picker needs from the outside, as narrow interfaces (interface segregation): browsing and adopting are separate, because
 * the wizard adopts into a draft and a project adopts into the real logframe, and neither should depend on the other's call.
 */
import type { LibraryFilters, LibraryEntryView, SectorSummary } from "../domain/library-dto";

export interface LibraryPage {
  libraryVersion: string;
  sectors: SectorSummary[];
  total: number;
  groups: Array<{ group: string; entries: LibraryEntryView[] }>;
}

export type PortResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface LibraryBrowser {
  /** The sectors with how many indicators each offers, without any entries. */
  sectors(): Promise<PortResult<SectorSummary[]>>;
  browse(filters: LibraryFilters, projectId?: string): Promise<PortResult<LibraryPage>>;
}

export interface AdoptOutcome { added: number; skipped: Array<{ id: string; reason: string }> }

/** Where chosen entries go. Each place that offers the picker supplies its own. */
export interface LibraryAdopter {
  adopt(ids: string[], target: { logframeItemId?: string; logframeCode?: string | null }): Promise<PortResult<AdoptOutcome>>;
  /** Adds the sector's suggested results, when the place can. */
  adoptSkeleton?(sectorId: string): Promise<PortResult<{ added: number }>>;
}
