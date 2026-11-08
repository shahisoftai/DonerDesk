/**
 * What the sector library API answers (Phase 46), as plain types. Types only: the web never imports the domain's code into a
 * client file (it would pull server-only modules into the browser bundle), so every import here is `import type`.
 */
import type {
  LibraryIndicator, LibraryIndicatorKind, LibraryLevel, LibraryReviewStatus, LibrarySectorId, LibraryUpdateState, PackPart,
} from "@donordesk/domain";

export interface LibraryEntryView extends LibraryIndicator {
  standardText: string | null;
  adopted: boolean;
  origin: "LIBRARY" | "ORGANISATION";
  reworded: boolean;
}

export interface SectorSummary { id: LibrarySectorId; label: string; group: "HUMANITARIAN" | "DEVELOPMENT" | "ATTACHED"; attached: boolean; count: number }

export interface SectorPackView { sectorId: LibrarySectorId; label: string; summary: string; attached: boolean; projectSector: string; parts: PackPart[] }

export interface IndicatorUpdateStatus { indicatorId: string; code: string; name: string; libraryId: string; update: LibraryUpdateState }

export interface SectorReviewProgress {
  sectorId: LibrarySectorId; label: string; total: number; byStatus: Record<LibraryReviewStatus, number>; verifiedStandards: number; standards: number;
}

export interface LibraryFilters {
  text: string;
  sectors: LibrarySectorId[];
  levels: LibraryLevel[];
  kinds: LibraryIndicatorKind[];
  reviewedOnly: boolean;
  recommendedOnly: boolean;
  withStandard: boolean;
}
