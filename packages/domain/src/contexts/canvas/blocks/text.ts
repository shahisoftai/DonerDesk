import { defineBlock } from "../block-definition.js";

export const CANVAS_MAX_TEXT = 4000;
export interface TextProps { text: string; role: "body" | "heading" | "caption" }

/** Plain authored text; a line starting `# ` is a heading. Words are escaped by every renderer, never trusted. */
export const textBlock = defineBlock<TextProps, { text: string; role: TextProps["role"] }, undefined>({
  kind: "TEXT",
  family: "TEXT",
  labelKey: "canvas.block.TEXT",
  defaults: () => ({ text: "", role: "body" }),
  validate: (p) => (p.text.length > CANVAS_MAX_TEXT ? [{ message: `Text is at most ${CANVAS_MAX_TEXT} characters.` }] : []),
  slots: [],
  sizes: { min: { w: 2, h: 1 }, max: { w: 12, h: 10 }, default: { w: 6, h: 2 } },
  lint: [],
  resolve: (p) => ((p.text ?? "").trim() ? { state: "ready", model: { text: p.text, role: p.role ?? "body" }, notes: [] } : { state: "empty", reason: "Nothing written yet." }),
});
