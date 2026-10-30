import { z } from "zod";

export const MapOverlayItemSchema = z.object({ id: z.string(), name: z.string(), sizeBytes: z.number(), featureCount: z.number(), createdAt: z.string() });
export type MapOverlayItem = z.infer<typeof MapOverlayItemSchema>;
export const MapOverlayListSchema = z.object({ overlays: z.array(MapOverlayItemSchema), canEdit: z.boolean() });
