/** The registry of area extraction specs (Phase 36.2): one entry per area; `extraction-specs.test` keeps it exhaustive. */
import type { AreaExtractionSpec } from "../area-spec.js";
import { FACTS_SPEC } from "./facts.js";
import { LOGFRAME_SPEC } from "./logframe.js";
import { INDICATORS_SPEC } from "./indicators.js";
import { PERIODS_SPEC } from "./periods.js";
import { PLAN_SPEC } from "./plan.js";
import { PLACES_SPEC } from "./places.js";
import { FUNDING_BUDGET_SPEC } from "./funding-budget.js";
import { RISKS_SPEC } from "./risks.js";

export const SETUP_EXTRACTION_SPECS: readonly AreaExtractionSpec[] = [
  FACTS_SPEC, LOGFRAME_SPEC, INDICATORS_SPEC, PERIODS_SPEC, PLAN_SPEC, PLACES_SPEC, FUNDING_BUDGET_SPEC, RISKS_SPEC,
];

export { SETUP_SYSTEM_RULES, SETUP_PROMPT_FAMILY } from "./rules.js";
