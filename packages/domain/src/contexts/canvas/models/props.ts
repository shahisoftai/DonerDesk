import type { InfographicSectionConfig } from "../../infographics/composition.js";
import type { BlockModel } from "../block-definition.js";
import type { CanvasFacts } from "../facts.js";

/** What an infographic-style block is set up with (the Studio's section settings, without its kind). */
export type SectionProps = Omit<InfographicSectionConfig, "kind">;
export type ModelFn = (props: SectionProps, facts: CanvasFacts | undefined) => BlockModel<unknown>;

export const empty = (reason: string): BlockModel<never> => ({ state: "empty", reason });
export const unavailable = (reason: string): BlockModel<never> => ({ state: "unavailable", reason });
export const ready = <M>(model: M, notes: string[] = []): BlockModel<M> => ({ state: "ready", model, notes });
export const NO_FACTS = "The project's figures were not read.";
