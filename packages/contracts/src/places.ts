import { z } from "zod";

const level = z.number().int().min(0).max(4);

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
