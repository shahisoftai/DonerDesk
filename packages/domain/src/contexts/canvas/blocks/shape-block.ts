import { SHAPE_NAMES, TONE_NAMES, type ShapeName, type ToneName } from "../../infographics/composition.js";
import { defineBlock } from "../block-definition.js";

/**
 * Plain shapes and icons for a page (Phase 48.14). They carry no figures: a shape is a frame, a rule or an arrow, an icon is one glyph
 * from the product's own icon set, and both take a colour from the page's theme, never a free colour, so a theme that is checked for
 * contrast stays checked. An icon that means something is described in `label`; one that only decorates is left without.
 */
export interface ShapeProps { shape: ShapeName; tone: ToneName; label?: string | undefined }

export const shapeBlock = defineBlock<ShapeProps, ShapeProps, undefined>({
  kind: "SHAPE",
  family: "MEDIA",
  bare: true,
  labelKey: "canvas.block.SHAPE",
  defaults: () => ({ shape: "ROUNDED", tone: "ACCENT2" }),
  validate: (p) => [
    ...((SHAPE_NAMES as readonly string[]).includes(p.shape) ? [] : [{ message: "Choose one of the offered shapes." }]),
    ...((TONE_NAMES as readonly string[]).includes(p.tone) ? [] : [{ message: "Choose one of the offered colours." }]),
    ...((p.label?.length ?? 0) > 120 ? [{ message: "Keep the description under 120 characters." }] : []),
  ],
  slots: [],
  sizes: { min: { w: 1, h: 1 }, max: { w: 12, h: 12 }, default: { w: 4, h: 2 } },
  lint: [],
  resolve: (p) => ({ state: "ready", model: p, notes: [] }),
});
