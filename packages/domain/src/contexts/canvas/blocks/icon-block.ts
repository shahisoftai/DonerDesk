import { TONE_NAMES, type ToneName } from "../../infographics/composition.js";
import { iconById } from "../../infographics/icons.js";
import { defineBlock } from "../block-definition.js";

/** One glyph from the product's own icon set (Phase 48.14), coloured from the page's theme; an icon that means something is described in `label`. */
export interface IconProps { iconId: string; tone: ToneName; label?: string | undefined }

export const iconBlock = defineBlock<IconProps, IconProps, undefined>({
  kind: "ICON",
  family: "MEDIA",
  bare: true,
  labelKey: "canvas.block.ICON",
  defaults: () => ({ iconId: "people", tone: "ACCENT" }),
  validate: (p) => [
    ...(iconById(p.iconId) ? [] : [{ message: "Choose an icon." }]),
    ...((TONE_NAMES as readonly string[]).includes(p.tone) ? [] : [{ message: "Choose one of the offered colours." }]),
    ...((p.label?.length ?? 0) > 120 ? [{ message: "Keep the description under 120 characters." }] : []),
  ],
  slots: [],
  sizes: { min: { w: 1, h: 1 }, max: { w: 4, h: 4 }, default: { w: 2, h: 2 } },
  lint: [],
  resolve: (p) => (iconById(p.iconId) ? { state: "ready", model: p, notes: [] } : { state: "empty", reason: "Choose an icon.", authoring: true }),
});
