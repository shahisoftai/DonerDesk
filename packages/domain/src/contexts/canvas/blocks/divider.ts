import { defineBlock } from "../block-definition.js";

export interface DividerProps { line: boolean }

export const dividerBlock = defineBlock<DividerProps, DividerProps, undefined>({
  kind: "DIVIDER",
  family: "TEXT",
  bare: true,
  labelKey: "canvas.block.DIVIDER",
  defaults: () => ({ line: true }),
  validate: () => [],
  slots: [],
  sizes: { min: { w: 12, h: 1 }, max: { w: 12, h: 1 }, default: { w: 12, h: 1 } },
  lint: [],
  resolve: (p) => ({ state: "ready", model: p, notes: [] }),
});
