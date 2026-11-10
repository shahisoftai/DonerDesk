import { z } from "zod";

/** The shape of a canvas on the wire (Phase 45). The domain re-checks every rule (kinds, positions, ids, limits) on save; this stops malformed input and bounds its size. */
const Bounds = z.object({ x: z.number().int().min(0).max(11), y: z.number().int().min(0).max(400), w: z.number().int().min(1).max(12), h: z.number().int().min(1).max(60) });
const Binding = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PROJECT"), slot: z.string().max(40), projectId: z.string().max(80) }),
  z.object({ type: z.literal("DATASET"), slot: z.string().max(40), projectId: z.string().max(80), query: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("REPORT"), slot: z.string().max(40), projectId: z.string().max(80), query: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("MANUAL"), slot: z.string().max(40), value: z.string().max(400), sourceNote: z.string().max(300).optional() }),
  z.object({ type: z.literal("AI_DRAFT"), slot: z.string().max(40), text: z.string().max(4000), acceptedAt: z.string().max(40).optional() }),
]);
const ParamValue = z.union([z.string().max(200), z.array(z.string().max(200)).max(100), z.object({ from: z.string().max(80), to: z.string().max(80) }), z.null()]);
/** What clicking a block does (Phase 48.3); the domain re-checks the destination (links stay inside the product). */
const BlockAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_PARAM"), param: z.string().max(30), value: z.union([ParamValue, z.literal("CLICKED_LABEL")]) }),
  z.object({ type: z.literal("OPEN_PAGE"), pageId: z.string().max(60) }),
  z.object({ type: z.literal("OPEN_CANVAS"), canvasId: z.string().max(64), params: z.record(z.string().max(30), ParamValue).optional() }),
  z.object({ type: z.literal("OPEN_LINK"), href: z.string().max(300) }),
  z.object({ type: z.literal("OPEN_TABLE") }),
]);
const FreeFrame = z.object({ x: z.number().min(-6000).max(6000), y: z.number().min(-6000).max(6000), w: z.number().min(1).max(6000), h: z.number().min(1).max(6000), rot: z.number().min(-360).max(360).optional(), z: z.number().int().min(0).max(1000).optional() });
const Space = z.enum(["none", "small", "medium", "large"]);
export const CanvasParameterSchema = z.object({
  id: z.string().min(1).max(30), label: z.string().min(1).max(60),
  kind: z.enum(["PERIOD", "PERIOD_RANGE", "PLACE", "GROUP", "STATUS", "INDICATOR", "PROJECT", "TEXT"]),
  default: ParamValue.optional(), allowed: z.array(z.string().max(200)).max(200).optional(), multiple: z.boolean().optional(), pageId: z.string().max(60).optional(),
});
export const CanvasBlockSchema = z.object({
  id: z.string().min(1).max(60), kind: z.string().min(1).max(40), bounds: Bounds, tablet: Bounds.optional(), phone: Bounds.optional(),
  props: z.record(z.string(), z.unknown()), bindings: z.array(Binding).max(8), container: z.object({ id: z.string().min(1).max(60), tab: z.number().int().min(0).max(5).optional() }).optional(),
  style: z.object({
    background: z.enum(["none", "card", "tint", "accent"]).optional(), align: z.enum(["start", "center", "end"]).optional(), hidden: z.boolean().optional(), locked: z.boolean().optional(),
    frame: z.string().max(30).optional(), border: z.enum(["none", "line", "accent"]).optional(), padding: Space.optional(), radius: Space.optional(), shadow: z.enum(["none", "small", "medium"]).optional(),
  }).optional(),
  alt: z.string().max(500).optional(), description: z.string().max(2000).optional(),
  free: FreeFrame.optional(),
  component: z.object({ id: z.string().max(64), version: z.number().int().min(1), key: z.string().max(60) }).optional(),
  paramBindings: z.array(z.object({ param: z.string().max(30), target: z.enum(["period", "periodRange", "place", "group", "status", "indicator", "project", "text"]) })).max(8).optional(),
  action: BlockAction.optional(),
  motion: z.object({ animation: z.enum(["NONE", "FADE", "RISE", "GROW", "COUNT_UP", "DRAW"]), durationMs: z.number().int().min(100).max(3000), delayMs: z.number().int().min(0).max(5000), easing: z.enum(["LINEAR", "EASE_OUT", "EASE_IN_OUT"]) }).optional(),
});
export const CanvasPageSchema = z.object({
  id: z.string().min(1).max(60), title: z.string().max(80), format: z.string().min(1).max(40), blocks: z.array(CanvasBlockSchema).max(60),
  mode: z.enum(["GRID", "FREE"]).optional(), size: z.object({ w: z.number().int().min(100).max(6000), h: z.number().int().min(100).max(6000) }).optional(),
  background: z.enum(["page", "card", "tint", "accent"]).optional(), themeId: z.string().max(40).optional(),
});
const Options = z.object({ periodFromId: z.string().max(80).optional(), periodToId: z.string().max(80).optional(), locationKeys: z.array(z.string().max(80)).max(50).optional(), acknowledgement: z.string().max(300).optional(), subtitle: z.string().max(200).optional() });

const Scope = z.enum(["ORG", "PROJECT", "MINE", "PORTFOLIO"]);
const Profile = z.enum(["LIVE_INTERNAL", "SNAPSHOT", "DONOR_REPORT", "SOCIAL", "INTERNAL"]);
const Mode = z.enum(["LIVE", "PUBLISHED_ONLY"]);

export const CreateCanvasSchema = z.object({
  title: z.string().trim().min(1).max(120), scope: Scope, projectId: z.string().max(80).optional(), mode: Mode.optional(), profile: Profile.optional(),
  language: z.string().max(10).optional(), themeId: z.string().max(40).optional(), format: z.string().max(40).optional(),
  pages: z.array(CanvasPageSchema).min(1).max(12).optional(), options: Options.optional(), params: z.array(CanvasParameterSchema).max(20).optional(),
});
export type CreateCanvasInput = z.infer<typeof CreateCanvasSchema>;

export const SaveCanvasSchema = z.object({
  expectedRevision: z.number().int().min(1), title: z.string().trim().min(1).max(120), pages: z.array(CanvasPageSchema).min(1).max(12),
  profile: Profile, mode: Mode.optional(), language: z.string().max(10), themeId: z.string().max(40), options: Options.optional(), params: z.array(CanvasParameterSchema).max(20).optional(),
});
export type SaveCanvasInput = z.infer<typeof SaveCanvasSchema>;

export const CanvasListQuerySchema = z.object({ projectId: z.string().max(80).optional() });
export const CanvasResolveQuerySchema = z.object({ periodId: z.string().max(80).optional(), places: z.string().max(400).optional(), group: z.string().max(80).optional(), status: z.string().max(80).optional(), level: z.string().max(80).optional(), indicator: z.string().max(80).optional() });
/** Places arrive as one comma-separated query value. */
export const placeKeysOf = (places: string | undefined): string[] => (places ?? "").split(",").map((p) => p.trim()).filter(Boolean).slice(0, 20);

/** An edited canvas that has not been saved, sent so the screen can show what it would say. Nothing is stored. */
export const PreviewCanvasSchema = SaveCanvasSchema.omit({ expectedRevision: true }).extend({ projectId: z.string().max(80).optional(), periodId: z.string().max(80).optional(), placeKeys: z.array(z.string().max(80)).max(20).optional(), group: z.string().max(80).optional(), status: z.string().max(80).optional(), level: z.string().max(80).optional(), indicator: z.string().max(80).optional() });
export type PreviewCanvasInput = z.infer<typeof PreviewCanvasSchema>;

export const CanvasExportQuerySchema = z.object({ format: z.enum(["PNG", "PDF", "SVG", "PPTX", "PACK"]), scale: z.coerce.number().int().min(1).max(3).optional() });

export const PublishCanvasSchema = z.object({ format: z.enum(["PNG", "PDF", "SVG", "PPTX"]), scale: z.coerce.number().int().min(1).max(3).optional() });
export const CreateCanvasShareSchema = z.object({ kind: z.enum(["LIVE", "FROZEN"]), label: z.string().trim().max(80).default("Link"), expiresInDays: z.number().int().min(1).max(180).default(30), exportId: z.string().max(80).optional() });
export const ReviewCanvasSchema = z.object({ action: z.enum(["SUBMIT", "APPROVE", "REQUEST_CHANGES", "REOPEN"]), note: z.string().trim().max(500).optional() });
export const CanvasSnapshotsSchema = z.object({ every: z.enum(["NONE", "WEEKLY", "MONTHLY"]) });
export const DraftCanvasTextSchema = z.object({ style: z.enum(["SUMMARY", "MESSAGES", "QUESTION"]), projectId: z.string().min(1).max(80), instruction: z.string().max(300).optional(), language: z.string().max(10).optional() });

/**
 * The tables a person is looking at, sent back to be made into a workbook (Phase 48.9). The workbook holds only what the sender already
 * sees; the limits keep one request small. A gap is `null` (an empty cell), never 0.
 */
export const CanvasDataWorkbookSchema = z.object({
  title: z.string().trim().min(1).max(120),
  tables: z.array(z.object({
    name: z.string().min(1).max(120),
    columns: z.array(z.string().max(160)).min(1).max(60),
    rows: z.array(z.array(z.union([z.string().max(1000), z.number(), z.null()])).max(60)).max(5000),
  })).min(1).max(30),
});
export type CanvasDataWorkbookInput = z.infer<typeof CanvasDataWorkbookSchema>;

/** How often a person wants to be told a canvas is ready to open (Phase 48.16). */
export const SubscribeCanvasSchema = z.object({ every: z.enum(["WEEKLY", "MONTHLY"]) });
export type SubscribeCanvasInput = z.infer<typeof SubscribeCanvasSchema>;

/** What a person tells the others they are doing on a canvas (Phase 48.8): the block they have selected and whether they are editing. */
export const PresenceUpdateSchema = z.object({ blockId: z.string().max(60).nullable(), editing: z.boolean() });
export type PresenceUpdateInput = z.infer<typeof PresenceUpdateSchema>;
