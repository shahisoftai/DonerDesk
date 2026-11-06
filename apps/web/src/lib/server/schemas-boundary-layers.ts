import { z } from "zod";

/** Boundary files an organisation uploaded for one country and level: metadata only (the GeoJSON itself comes from the data route). */
export const BoundaryLayerMetaSchema = z.object({
  iso: z.string(),
  countryName: z.string(),
  adminLevel: z.number().int(),
  name: z.string(),
  featureCount: z.number().int(),
  sizeBytes: z.number(),
  /** The file carries codes, so places can be joined to it exactly. */
  hasCodes: z.boolean(),
  uploadedAt: z.string(),
});
export type BoundaryLayerMeta = z.infer<typeof BoundaryLayerMetaSchema>;
export const BoundaryLayerListSchema = z.object({ layers: z.array(BoundaryLayerMetaSchema) });
export const BoundaryLayerRemovedSchema = z.object({ removed: z.boolean() });
