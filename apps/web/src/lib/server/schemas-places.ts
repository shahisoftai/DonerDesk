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
  facility: z.boolean().optional(),
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

const RollupRowSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  path: z.string(),
  adminLevel: z.number().int(),
  value: z.string().nullable(),
  verified: z.boolean(),
  unverified: z.number().int(),
  contributors: z.number().int(),
  listedBelow: z.number().int(),
  partly: z.boolean(),
});
export type PlaceRollupRow = z.infer<typeof RollupRowSchema>;

export const PlaceResultsSchema = z.object({
  level: z.number().int(),
  levelsAvailable: z.array(z.number().int()),
  periods: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
  noPlaces: z.boolean(),
  indicators: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    unit: z.string().nullable(),
    type: z.string(),
    isRate: z.boolean(),
    rollup: z.object({
      level: z.number().int(),
      additive: z.boolean(),
      rows: z.array(RollupRowSchema),
      unplaced: z.array(z.object({
        location: z.string(),
        value: z.string(),
        reason: z.enum(["NOT_IN_LIST", "MORE_THAN_ONE_PLACE", "ABOVE_LEVEL"]),
        candidates: z.array(z.string()).optional(),
      })),
    }),
  })),
  withoutLocation: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
});
export type PlaceResults = z.infer<typeof PlaceResultsSchema>;
