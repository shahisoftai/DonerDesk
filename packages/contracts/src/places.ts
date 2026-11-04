import { z } from "zod";

const level = z.number().int().min(0).max(4);

/** How a place's location came to be. Mirrors `PLACED_BY` in the domain (pinned by the architecture test). */
export const PLACED_BY_VALUES = ["TYPED", "MAP_PIN", "MAP_DRAWN", "SNAPPED", "IMPORT", "GPS"] as const;
const placedBy = z.enum(PLACED_BY_VALUES);

/** What a person says when adding a place: its name, what kind of place, what it is inside, and (for a site) a pin. */
export const CreatePlaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["POINT", "AREA"]).default("AREA"),
  adminLevel: level,
  parentId: z.string().min(1).optional(),
  country: z.string().trim().max(80).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  code: z.string().trim().max(60).optional(),
  facility: z.boolean().optional(),
  placedBy: placedBy.optional(),
});
export type CreatePlaceInput = z.infer<typeof CreatePlaceSchema>;

/** `parentId`/`latitude`/`longitude`/`code`/`country` of `null` clear the field. */
export const UpdatePlaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(["POINT", "AREA"]).optional(),
  adminLevel: level.optional(),
  parentId: z.string().min(1).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  code: z.string().trim().max(60).nullable().optional(),
  facility: z.boolean().optional(),
  placedBy: placedBy.optional(),
});
export type UpdatePlaceInput = z.infer<typeof UpdatePlaceSchema>;

/** `apply: false` previews and saves nothing (the plan wizard's rule). */
export const ImportPlacesSchema = z.object({
  text: z.string().min(1).max(500_000),
  apply: z.boolean().default(false),
});
export type ImportPlacesInput = z.infer<typeof ImportPlacesSchema>;

export const ResolvePlacesSchema = z.object({
  texts: z.array(z.string().max(200)).min(1).max(200),
  withinId: z.string().min(1).optional(),
  country: z.string().max(80).optional(),
});
export type ResolvePlacesInput = z.infer<typeof ResolvePlacesSchema>;

export const ListPlacesQuerySchema = z.object({
  includeArchived: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

/**
 * A drawn outline or route for an area. The shape is checked by the domain (`validateGeometry`), the one rule for server and browser;
 * here it is only required to be present, so every refusal comes back as a plain sentence about the shape.
 */
export const SetPlaceGeometrySchema = z.object({ geometry: z.unknown().refine((g) => g !== undefined, "Draw an outline or a route on the map") });
export type SetPlaceGeometryInput = z.infer<typeof SetPlaceGeometrySchema>;

/**
 * The fields sent beside a boundary file when it is uploaded (multipart: these come first, the file last). The file's own contents are
 * checked by the domain (`validateBoundaryLayer`); here only the shape of the choices is.
 */
export const UploadBoundaryLayerFieldsSchema = z.object({
  iso: z.string().trim().min(1).max(8),
  countryName: z.string().trim().min(1).max(80),
  adminLevel: z.coerce.number().int().min(1).max(4),
  nameField: z.string().trim().min(1).max(120),
  pcodeField: z.string().trim().max(120).optional(),
  parentPcodeField: z.string().trim().max(120).optional(),
});
export type UploadBoundaryLayerFields = z.infer<typeof UploadBoundaryLayerFieldsSchema>;

/** A country's built-in boundary units, sent by the browser that holds the boundary files (phase 42.2). */
export const SeedPlacesFromBoundariesSchema = z.object({
  country: z.object({ name: z.string().trim().min(1).max(120) }).strict(),
  units: z.array(z.object({
    ref: z.string().min(1).max(80),
    parentRef: z.string().min(1).max(80).optional(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(40).optional(),
  }).strict()).max(25_000),
  apply: z.boolean().default(false),
}).strict();
export type SeedPlacesFromBoundariesInput = z.infer<typeof SeedPlacesFromBoundariesSchema>;
