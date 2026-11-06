import { z } from "zod";
import type { BlockModel, Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import { ChartDrawingSchema } from "./schemas-dashboards";

/** The canvas document is checked in full by the API on every save; on the way in it is typed, not re-validated field by field. */
const CanvasDoc = z.custom<Canvas>((v) => typeof v === "object" && v !== null && Array.isArray((v as { pages?: unknown }).pages));

export const CanvasSummarySchema = z.object({
  id: z.string(), title: z.string(), scope: z.enum(["ORG", "PROJECT", "MINE", "PORTFOLIO"]), mode: z.enum(["LIVE", "PUBLISHED_ONLY"]),
  profile: z.string(), projectId: z.string().optional(), ownerId: z.string(), mine: z.boolean(), canEdit: z.boolean(),
  blockCount: z.number(), pageCount: z.number(), revision: z.number(), updatedAt: z.string(), sourceKind: z.string().optional(),
});
export type CanvasSummary = z.infer<typeof CanvasSummarySchema>;
export const CanvasListSchema = z.array(CanvasSummarySchema);
export const CanvasSchema = CanvasSummarySchema.extend({ canvas: CanvasDoc });
export type CanvasView = z.infer<typeof CanvasSchema>;

export const CanvasProblemSchema = z.object({ pageId: z.string(), blockId: z.string(), message: z.string() });
export type CanvasProblemView = z.infer<typeof CanvasProblemSchema>;
export const SavedCanvasSchema = z.object({ canvas: CanvasSchema, problems: z.array(CanvasProblemSchema) });

const Model = z.custom<BlockModel<unknown>>((v) => typeof v === "object" && v !== null && "state" in (v as object));
export const ResolvedCanvasSchema = z.object({ canvasId: z.string(), drawings: z.array(ChartDrawingSchema), models: z.record(Model) });
export type ResolvedCanvas = z.infer<typeof ResolvedCanvasSchema>;

export const ConvertedCanvasSchema = z.object({ canvas: CanvasSchema, created: z.boolean(), unreadable: z.array(z.object({ widgetId: z.string(), reason: z.string() })) });
