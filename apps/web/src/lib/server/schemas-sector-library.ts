import { z } from "zod";
import type { LibraryEntryView, SectorSummary, SectorPackView, IndicatorUpdateStatus, SectorReviewProgress } from "@/features/sector-library/domain/library-dto";

/** The sector library as the API answers it (Phase 46). Entries are the API's own typed shape, trusted as it sends them. */
const entry = z.custom<LibraryEntryView>((v) => typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string");

export const BrowseLibraryResultSchema = z.object({
  libraryVersion: z.string(),
  sectors: z.array(z.custom<SectorSummary>((v) => typeof v === "object" && v !== null)),
  total: z.number(),
  groups: z.array(z.object({ group: z.string(), entries: z.array(entry) })),
  adoptedIds: z.array(z.string()),
  skipped: z.array(z.object({ entryId: z.string(), reason: z.string() })),
});
export type BrowseLibraryResult = z.infer<typeof BrowseLibraryResultSchema>;

export const SectorPackViewSchema = z.custom<SectorPackView>((v) => typeof v === "object" && v !== null && Array.isArray((v as { parts?: unknown }).parts));

export const AdoptResultSchema = z.object({
  created: z.array(z.object({ libraryId: z.string(), indicatorId: z.string(), code: z.string() })),
  skipped: z.array(z.object({ libraryId: z.string(), reason: z.string() })),
});
export type AdoptResult = z.infer<typeof AdoptResultSchema>;

export const AdoptSkeletonResultSchema = z.object({
  created: z.array(z.object({ key: z.string(), id: z.string(), title: z.string() })),
  reused: z.array(z.object({ key: z.string(), id: z.string(), title: z.string() })),
  skipped: z.array(z.object({ key: z.string(), reason: z.string() })),
});
export type AdoptSkeletonResult = z.infer<typeof AdoptSkeletonResultSchema>;

export const LibraryUpdatesSchema = z.array(z.custom<IndicatorUpdateStatus>((v) => typeof v === "object" && v !== null));
export const ApplyUpdateResultSchema = z.object({ applied: z.array(z.string()) });

export const ReviewProgressSchema = z.object({
  sectors: z.array(z.custom<SectorReviewProgress>((v) => typeof v === "object" && v !== null)),
  total: z.number(),
  reviewed: z.number(),
});
export const ReviewSheetSchema = z.object({ text: z.string(), rows: z.number() });
export const ReviewImportSchema = z.object({ decisions: z.number(), problems: z.array(z.object({ row: z.number(), message: z.string() })), applied: z.boolean() });
export const RecordedSchema = z.object({ recorded: z.number() });
export const HiddenSchema = z.object({ entryId: z.string(), hidden: z.boolean() });
