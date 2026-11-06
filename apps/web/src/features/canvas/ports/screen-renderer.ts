import type { ComponentType } from "react";
import type { BlockModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";

/**
 * What a block's screen renderer is given (Phase 45, interface segregation): its resolved model and the frame it paints in. Not the
 * canvas, not the session, not the data sheet. The same model goes to the print painter in the server, so the figures cannot differ.
 */
export interface ScreenRendererProps<M = unknown> {
  model: BlockModel<M>;
  frame: PaintFrame;
  /** Where a picture the model names can be loaded from; absent = the block shows its words only, and says so. */
  assetUrl?: ((assetId: string) => string | undefined) | undefined;
}
export type ScreenRenderer<M = unknown> = ComponentType<ScreenRendererProps<M>>;
