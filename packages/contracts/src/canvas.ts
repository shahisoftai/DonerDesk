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
export const CanvasBlockSchema = z.object({
  id: z.string().min(1).max(60), kind: z.string().min(1).max(40), bounds: Bounds, tablet: Bounds.optional(), phone: Bounds.optional(),
  props: z.record(z.string(), z.unknown()), bindings: z.array(Binding).max(8), container: z.object({ id: z.string().min(1).max(60), tab: z.number().int().min(0).max(5).optional() }).optional(),
  style: z.object({ background: z.enum(["none", "card", "tint", "accent"]).optional(), align: z.enum(["start", "center", "end"]).optional(), hidden: z.boolean().optional(), locked: z.boolean().optional() }).optional(),
  alt: z.string().max(500).optional(), description: z.string().max(2000).optional(),
});
export const CanvasPageSchema = z.object({ id: z.string().min(1).max(60), title: z.string().max(80), format: z.string().min(1).max(40), blocks: z.array(CanvasBlockSchema).max(60) });
const Options = z.object({ periodFromId: z.string().max(80).optional(), periodToId: z.string().max(80).optional(), locationKeys: z.array(z.string().max(80)).max(50).optional(), acknowledgement: z.string().max(300).optional(), subtitle: z.string().max(200).optional() });

const Scope = z.enum(["ORG", "PROJECT", "MINE", "PORTFOLIO"]);
const Profile = z.enum(["LIVE_INTERNAL", "SNAPSHOT", "DONOR_REPORT", "SOCIAL", "INTERNAL"]);
const Mode = z.enum(["LIVE", "PUBLISHED_ONLY"]);

export const CreateCanvasSchema = z.object({
  title: z.string().trim().min(1).max(120), scope: Scope, projectId: z.string().max(80).optional(), mode: Mode.optional(), profile: Profile.optional(),
  language: z.string().max(10).optional(), themeId: z.string().max(40).optional(), format: z.string().max(40).optional(),
  pages: z.array(CanvasPageSchema).min(1).max(12).optional(), options: Options.optional(),
});
export type CreateCanvasInput = z.infer<typeof CreateCanvasSchema>;

export const SaveCanvasSchema = z.object({
  expectedRevision: z.number().int().min(1), title: z.string().trim().min(1).max(120), pages: z.array(CanvasPageSchema).min(1).max(12),
  profile: Profile, mode: Mode.optional(), language: z.string().max(10), themeId: z.string().max(40), options: Options.optional(),
});
export type SaveCanvasInput = z.infer<typeof SaveCanvasSchema>;

export const CanvasListQuerySchema = z.object({ projectId: z.string().max(80).optional() });
export const CanvasResolveQuerySchema = z.object({ periodId: z.string().max(80).optional(), places: z.string().max(400).optional(), group: z.string().max(80).optional(), status: z.string().max(80).optional() });
/** Places arrive as one comma-separated query value. */
export const placeKeysOf = (places: string | undefined): string[] => (places ?? "").split(",").map((p) => p.trim()).filter(Boolean).slice(0, 20);

/** An edited canvas that has not been saved, sent so the screen can show what it would say. Nothing is stored. */
export const PreviewCanvasSchema = SaveCanvasSchema.omit({ expectedRevision: true }).extend({ projectId: z.string().max(80).optional(), periodId: z.string().max(80).optional(), placeKeys: z.array(z.string().max(80)).max(20).optional(), group: z.string().max(80).optional(), status: z.string().max(80).optional() });
export type PreviewCanvasInput = z.infer<typeof PreviewCanvasSchema>;

export const CanvasExportQuerySchema = z.object({ format: z.enum(["PNG", "PDF", "SVG", "PPTX", "PACK"]), scale: z.coerce.number().int().min(1).max(3).optional() });

export const PublishCanvasSchema = z.object({ format: z.enum(["PNG", "PDF", "SVG", "PPTX"]), scale: z.coerce.number().int().min(1).max(3).optional() });
export const CreateCanvasShareSchema = z.object({ kind: z.enum(["LIVE", "FROZEN"]), label: z.string().trim().max(80).default("Link"), expiresInDays: z.number().int().min(1).max(180).default(30), exportId: z.string().max(80).optional() });
export const ReviewCanvasSchema = z.object({ action: z.enum(["SUBMIT", "APPROVE", "REQUEST_CHANGES", "REOPEN"]), note: z.string().trim().max(500).optional() });
export const CanvasSnapshotsSchema = z.object({ every: z.enum(["NONE", "WEEKLY", "MONTHLY"]) });
export const DraftCanvasTextSchema = z.object({ style: z.enum(["SUMMARY", "MESSAGES", "QUESTION"]), projectId: z.string().min(1).max(80), instruction: z.string().max(300).optional(), language: z.string().max(10).optional() });
