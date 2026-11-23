import type { FormDefinition } from "../form-model.js";

/**
 * A kit is a ready-made form for a kind of assessment: its questions, rules and score. Kits are DATA (one file each); the engine never
 * names one. They ship UNREVIEWED: a sector reviewer checks the wording, the weights and the bands before anyone relies on the result.
 */
export interface FormKit {
  id: string;
  name: string;
  sector: string;
  description: string;
  /** Where the questions came from. */
  source: string;
  unreviewed: true;
  build(): FormDefinition;
  /** Indicators a programme may want to track from the records (the person creates them; nothing is created for them). */
  suggestedIndicators: ReadonlyArray<{ code: string; name: string; unit: string; method: "PERCENT_WHERE" | "COUNT_WHERE" | "AVERAGE_SCORE" | "COUNT"; plain: string }>;
  /** What the kit leaves out and why, shown beside the kit. */
  notes: ReadonlyArray<string>;
}
