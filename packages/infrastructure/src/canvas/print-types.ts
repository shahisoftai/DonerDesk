import type { BlockModel, SectionProps } from "@donordesk/domain";
import type { RenderCtx, Slot } from "../infographics/kit.js";

/**
 * What a print painter is given (Phase 45.2): the block's resolved model, the page context (theme, scale, language), the heading to
 * show and the width it may use. It returns the block's SVG, or `undefined` for a block an export leaves out. A painter never reads
 * the project's data: every figure comes from `model`, the same one the screen paints.
 */
export interface PrintInput<M = unknown> {
  model: BlockModel<M>;
  ctx: RenderCtx;
  props: SectionProps;
  title: string | undefined;
  width: number;
}
export type PrintPainter<M = never> = (input: PrintInput<M>) => Slot | undefined;
