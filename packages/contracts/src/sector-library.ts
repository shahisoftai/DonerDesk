import { z } from "zod";

const csv = (v: unknown): unknown => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v);
const flag = (v: unknown): unknown => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : v);

/** What the picker asks for. Lists arrive as comma-separated text in the query string. */
export const BrowseLibraryQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  sectors: z.preprocess(csv, z.array(z.string().min(1).max(60)).max(40)).optional(),
  text: z.string().max(200).optional(),
  sources: z.preprocess(csv, z.array(z.string().min(1).max(60)).max(30)).optional(),
  levels: z.preprocess(csv, z.array(z.enum(["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"])).max(4)).optional(),
  kinds: z.preprocess(csv, z.array(z.enum(["COUNT", "RATE", "RATIO", "INDEX", "BINARY", "QUALITATIVE"])).max(6)).optional(),
  reviewedOnly: z.preprocess(flag, z.boolean()).optional(),
  recommendedOnly: z.preprocess(flag, z.boolean()).optional(),
  withStandard: z.preprocess(flag, z.boolean()).optional(),
  includeAdopted: z.preprocess(flag, z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
export type BrowseLibraryQuery = z.infer<typeof BrowseLibraryQuerySchema>;

export const AdoptLibraryIndicatorsSchema = z.object({
  projectId: z.string().min(1),
  items: z.array(z.object({ libraryId: z.string().min(1).max(60), logframeItemId: z.string().min(1).optional() })).min(1).max(100),
});
export type AdoptLibraryIndicatorsInput = z.infer<typeof AdoptLibraryIndicatorsSchema>;

export const AdoptLibraryLogframeSchema = z.object({
  projectId: z.string().min(1),
  sectorId: z.string().min(1).max(60),
  nodeKeys: z.array(z.string().min(1).max(60)).max(60).optional(),
});
export type AdoptLibraryLogframeInput = z.infer<typeof AdoptLibraryLogframeSchema>;

export const ApplyLibraryUpdateSchema = z.object({
  fields: z.array(z.enum(["name", "unit", "frequency", "meansOfVerification", "direction", "aggregation"])).max(6),
});

export const SaveLibraryEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADDED"), entry: z.record(z.unknown()) }),
  z.object({ kind: z.literal("OVERRIDE"), entryId: z.string().min(1).max(60), patch: z.record(z.unknown()) }),
  z.object({ kind: z.literal("CLEAR"), entryId: z.string().min(1).max(60) }),
]);
export type SaveLibraryEntryInput = z.infer<typeof SaveLibraryEntrySchema>;

export const SetLibraryEntryHiddenSchema = z.object({ hidden: z.boolean() });

export const RecordLibraryReviewSchema = z.object({
  entryIds: z.array(z.string().min(1).max(60)).min(1).max(500),
  status: z.enum(["UNREVIEWED", "IN_REVIEW", "REVIEWED"]),
  reviewer: z.string().max(120).default(""),
  note: z.string().max(500).optional(),
});
export type RecordLibraryReviewInput = z.infer<typeof RecordLibraryReviewSchema>;

export const ImportLibraryReviewSheetSchema = z.object({ text: z.string().min(1).max(2_000_000), reviewer: z.string().max(120).default(""), apply: z.boolean().default(false) });
