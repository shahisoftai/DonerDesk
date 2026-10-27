import { z } from "zod";

export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["POINT", "AREA"]),
  adminLevel: z.number().int(),
  parentId: z.string().optional(),
  path: z.string(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  aliases: z.array(z.string()),
  code: z.string().optional(),
  archived: z.boolean(),
  childCount: z.number().int(),
});
export type PlaceItem = z.infer<typeof PlaceSchema>;

export const PlaceListSchema = z.object({ places: z.array(PlaceSchema), canEdit: z.boolean() });
export type PlaceList = z.infer<typeof PlaceListSchema>;

const Brief = z.object({ id: z.string(), name: z.string(), path: z.string() });

export const UnconfirmedLocationsSchema = z.object({
  items: z.array(z.object({
    text: z.string(),
    count: z.number().int(),
    sources: z.array(z.string()),
    status: z.enum(["UNRESOLVED", "AMBIGUOUS"]),
    candidates: z.array(Brief).optional(),
  })),
  confirmed: z.number().int(),
});
export type UnconfirmedLocations = z.infer<typeof UnconfirmedLocationsSchema>;

export const PlaceImportPreviewSchema = z.object({
  create: z.array(z.object({ name: z.string(), level: z.number().int(), path: z.string() })),
  skipped: z.array(z.object({ row: z.number().int(), name: z.string() })),
  problems: z.array(z.object({ row: z.number().int(), message: z.string() })),
  applied: z.boolean(),
});
export type PlaceImportPreview = z.infer<typeof PlaceImportPreviewSchema>;
