import { z } from "zod";
import type { BlockModel, Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import { ChartDrawingSchema } from "./schemas-dashboards";

/** The canvas document is checked in full by the API on every save; on the way in it is typed, not re-validated field by field. */
const CanvasDoc = z.custom<Canvas>((v) => typeof v === "object" && v !== null && Array.isArray((v as { pages?: unknown }).pages));

export const CanvasSummarySchema = z.object({
  id: z.string(), title: z.string(), scope: z.enum(["ORG", "PROJECT", "MINE", "PORTFOLIO"]), mode: z.enum(["LIVE", "PUBLISHED_ONLY"]),
  profile: z.string(), projectId: z.string().optional(), ownerId: z.string(), mine: z.boolean(), canEdit: z.boolean(),
  blockCount: z.number(), pageCount: z.number(), revision: z.number(), updatedAt: z.string(), sourceKind: z.string().optional(),
  reviewStatus: z.string().default("DRAFT"), reviewNote: z.string().optional(), snapshotEvery: z.string().default("NONE"), lastSnapshotAt: z.string().optional(),
});
export type CanvasSummary = z.infer<typeof CanvasSummarySchema>;
export const CanvasListSchema = z.array(CanvasSummarySchema);
export const CanvasSchema = CanvasSummarySchema.extend({ canvas: CanvasDoc });
export type CanvasView = z.infer<typeof CanvasSchema>;

export const CanvasProblemSchema = z.object({ pageId: z.string(), blockId: z.string(), message: z.string() });
export type CanvasProblemView = z.infer<typeof CanvasProblemSchema>;
export const SavedCanvasSchema = z.object({ canvas: CanvasSchema, problems: z.array(CanvasProblemSchema) });

const Model = z.custom<BlockModel<unknown>>((v) => typeof v === "object" && v !== null && "state" in (v as object));
export const ChoicesSchema = z.object({ periods: z.array(z.object({ id: z.string(), label: z.string() })), places: z.array(z.object({ key: z.string(), label: z.string() })), groups: z.array(z.string()).default([]), statuses: z.array(z.string()).default([]) });
export const ResolvedCanvasSchema = z.object({ canvasId: z.string(), drawings: z.array(ChartDrawingSchema), models: z.record(Model), choices: ChoicesSchema.default({ periods: [], places: [], groups: [], statuses: [] }), repeats: z.record(z.array(z.object({ key: z.string(), label: z.string() }))).default({}) });
export type ResolvedCanvas = z.infer<typeof ResolvedCanvasSchema>;

export const ConvertedCanvasSchema = z.object({ canvas: CanvasSchema, created: z.boolean(), unreadable: z.array(z.object({ widgetId: z.string(), reason: z.string() })) });

export const CanvasExportSchema = z.object({ id: z.string(), canvasId: z.string(), format: z.string(), sizeBytes: z.number(), createdAt: z.string(), createdById: z.string() });
export type CanvasExportView = z.infer<typeof CanvasExportSchema>;
export const CanvasShareLinkSchema = z.object({ id: z.string(), kind: z.enum(["LIVE", "FROZEN"]), label: z.string(), exportId: z.string().optional(), expiresAt: z.string(), revoked: z.boolean(), expired: z.boolean() });
export type CanvasShareLinkView = z.infer<typeof CanvasShareLinkSchema>;
export const CreatedShareSchema = z.object({ id: z.string(), token: z.string(), expiresAt: z.string() });
export const CanvasVersionSchema = z.object({ revision: z.number(), title: z.string(), savedById: z.string(), savedAt: z.string() });
export type CanvasVersionView = z.infer<typeof CanvasVersionSchema>;
export const CanvasVersionDocSchema = z.object({ revision: z.number(), title: z.string(), canvas: CanvasDoc });
export const ReviewResultSchema = z.object({ status: z.string(), note: z.string().optional() });
export const SnapshotResultSchema = z.object({ every: z.string() });
export const DraftTextSchema = z.union([z.object({ available: z.literal(false), reason: z.string() }), z.object({ available: z.literal(true), text: z.string(), dropped: z.number(), note: z.string() })]);
export type DraftTextView = z.infer<typeof DraftTextSchema>;
export const PublicCanvasSchema = z.union([
  z.object({ kind: z.literal("FROZEN"), title: z.string() }),
  z.object({ kind: z.literal("LIVE"), title: z.string(), canvas: CanvasDoc, drawings: z.array(ChartDrawingSchema), models: z.record(Model) }),
]);
