import { z } from "zod";

/** Response shapes of the Phase 56 place-tree routes. */
const PlaceBriefSchema = z.object({
  id: z.string(), name: z.string(), path: z.string(), adminLevel: z.number(), kind: z.enum(["POINT", "AREA"]), facility: z.boolean(), code: z.string().optional(),
  latitude: z.number().optional(), longitude: z.number().optional(),
});
export type PlaceBriefDto = z.infer<typeof PlaceBriefSchema>;

const ExtensionSchema = z.object({ placeId: z.string(), name: z.string(), path: z.string() });
const FootprintSchema = z.enum(["INSIDE", "OUTSIDE", "NO_FOOTPRINT", "UNKNOWN"]);
const KindCountsSchema = z.object({ PLANNED_ACTIVITY: z.number(), ACTIVITY: z.number(), EVIDENCE: z.number(), BENEFICIARY: z.number() });

export const ProjectPlacesSchema = z.object({
  areas: z.array(PlaceBriefSchema.extend({ closed: z.boolean(), closedReason: z.string().nullable(), records: z.number() })),
  sites: z.array(PlaceBriefSchema.extend({ counts: KindCountsSchema, footprint: FootprintSchema, extension: ExtensionSchema.optional() })),
  unconfirmed: z.array(z.object({ text: z.string(), count: z.number(), status: z.enum(["UNRESOLVED", "AMBIGUOUS"]), candidates: z.array(z.object({ id: z.string(), name: z.string(), path: z.string() })) })),
  forNewWork: z.array(z.string()),
  canEdit: z.boolean(),
});
export type ProjectPlacesDto = z.infer<typeof ProjectPlacesSchema>;

export const TickAreaResultSchema = z.object({ placeId: z.string(), replaced: z.array(z.string()) });

export const RecordPlacesSchema = z.object({
  places: z.array(PlaceBriefSchema.extend({ source: z.enum(["INHERITED", "CHOSEN", "CONFIRMED", "GPS"]), footprint: FootprintSchema, extension: ExtensionSchema.optional() })),
  inherited: z.boolean(),
  typed: z.string().nullable(),
  canEdit: z.boolean(),
  many: z.boolean().default(true),
  max: z.number().default(20),
});
export type RecordPlacesDto = z.infer<typeof RecordPlacesSchema>;

export const SetRecordPlacesResultSchema = z.object({ outside: z.array(z.string()) });
export const ConfirmWordResultSchema = z.object({ linked: z.number() });
export const InlinePlaceResultSchema = z.object({ place: PlaceBriefSchema, outside: z.boolean(), existed: z.boolean() });
export type InlinePlaceResult = z.infer<typeof InlinePlaceResultSchema>;

export const WhereWeWorkSchema = z.object({
  level: z.number(),
  areas: z.array(PlaceBriefSchema.extend({ projects: z.array(z.object({ id: z.string(), title: z.string() })), plannedActivities: z.number(), activities: z.number() })),
  overlaps: z.number(),
  notPlacedAtLevel: z.number(),
  projectsWithoutAreas: z.array(z.object({ id: z.string(), title: z.string() })),
  canManage: z.boolean(),
});
export type WhereWeWorkDto = z.infer<typeof WhereWeWorkSchema>;

export const PlaceProfileSchema = z.object({
  place: PlaceBriefSchema,
  chain: z.array(PlaceBriefSchema),
  children: z.array(PlaceBriefSchema),
  projects: z.array(z.object({ id: z.string(), title: z.string(), covers: z.boolean(), plannedActivities: z.number(), activities: z.number() })),
});
export type PlaceProfileDto = z.infer<typeof PlaceProfileSchema>;

export const DuplicatePlacesSchema = z.object({ pairs: z.array(z.object({ keep: PlaceBriefSchema, merge: PlaceBriefSchema, reason: z.enum(["SAME_NAME", "SAME_CODE"]) })) });
export type DuplicatePlacesDto = z.infer<typeof DuplicatePlacesSchema>;
export const MergeResultSchema = z.object({ moved: z.number() });

const SettingSchema = z.object({ scope: z.enum(["PROJECT", "LEVEL", "CHOSEN"]), level: z.number().nullable().optional(), placeIds: z.array(z.string()).optional() });
export const IndicatorPlacesSchema = z.object({ setting: SettingSchema, rows: z.array(z.object({ placeId: z.string(), name: z.string(), path: z.string() })), canEdit: z.boolean() });
export type IndicatorPlacesDto = z.infer<typeof IndicatorPlacesSchema>;
export const IndicatorPlaceSettingSchema = SettingSchema;
