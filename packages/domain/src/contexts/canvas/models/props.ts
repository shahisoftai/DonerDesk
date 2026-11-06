import type { InfographicSectionConfig } from "../../infographics/composition.js";
import type { BlockModel } from "../block-definition.js";
import type { CanvasFacts } from "../facts.js";

/** What an infographic-style block is set up with (the Studio's section settings, without its kind). */
export type SectionProps = Omit<InfographicSectionConfig, "kind">;
export type ModelFn = (props: SectionProps, facts: CanvasFacts | undefined) => BlockModel<unknown>;

export const empty = (reason: string): BlockModel<never> => ({ state: "empty", reason });
/** Nothing yet because a person has not written or chosen it: shown as a prompt, not as missing data. */
export const prompt = (reason: string): BlockModel<never> => ({ state: "empty", reason, authoring: true });
export const unavailable = (reason: string): BlockModel<never> => ({ state: "unavailable", reason });
export const ready = <M>(model: M, notes: string[] = []): BlockModel<M> => ({ state: "ready", model, notes });
export const NO_FACTS = "The project's figures were not read.";

/** Settings come from people (and from older designs), so a field may be the wrong type: a word is a string or nothing, a list holds only objects. */
export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const records = <T extends object>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x !== null && typeof x === "object" && !Array.isArray(x)) as T[]) : []);
export const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
