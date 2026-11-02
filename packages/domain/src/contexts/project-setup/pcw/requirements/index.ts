/**
 * Every requirement, in slide order. Adding one is a row in its slide's list; the pins in `pcw.test.mjs` fail until it has a
 * unique key, belongs to a real slide and names the setup steps it covers.
 */
import type { RequirementDef } from "../requirement.js";
import { ENTRY_REQUIREMENTS, REPORTING_REQUIREMENTS } from "./entry-reporting.js";
import { FINANCE_REQUIREMENTS, LAUNCH_REQUIREMENTS } from "./finance-launch.js";
import { PLACES_REQUIREMENTS, PLAN_REQUIREMENTS } from "./places-plan.js";
import { INDICATOR_REQUIREMENTS, RESULTS_REQUIREMENTS } from "./results-indicators.js";
import { START_REQUIREMENTS, TEAM_REQUIREMENTS } from "./start-team.js";

export const SETUP_REQUIREMENTS: readonly RequirementDef[] = [
  ...START_REQUIREMENTS,
  ...TEAM_REQUIREMENTS,
  ...RESULTS_REQUIREMENTS,
  ...INDICATOR_REQUIREMENTS,
  ...PLACES_REQUIREMENTS,
  ...PLAN_REQUIREMENTS,
  ...ENTRY_REQUIREMENTS,
  ...REPORTING_REQUIREMENTS,
  ...FINANCE_REQUIREMENTS,
  ...LAUNCH_REQUIREMENTS,
];

/**
 * Setup steps no person decides on a slide: Launch does them itself (6 sign-off is the gate, 35 the Drive folder tree,
 * 44-47 the review, the checks, the sign-off and the start). Pinned so the 47-step list stays fully accounted for.
 */
export const AUTOMATIC_STEPS: readonly number[] = [6, 35, 44, 45, 46, 47];

/**
 * Steps the first build deliberately leaves out of the Launch gate, with the reason (honest, not hidden): the draft has no
 * place to hold them yet. They stay on the list until a batch adds them.
 */
export const DEFERRED_STEPS: Readonly<Record<number, string>> = {
  10: "Donor indicator mapping is made on the Logframe page after Launch; the draft does not hold it yet.",
  29: "Who approves spending follows people's roles on the project; the product has no named finance approver to set.",
  34: "Collection links and partner access are created on demand after Launch.",
  36: "Confidentiality is chosen for each file when it is added; the product has no project-wide default to set.",
  37: "Confidentiality is chosen for each file when it is added; the product has no project-wide default to set.",
  39: "The checklist is built from the project's data and the donor's requirements as each report is prepared, so it cannot be written in advance.",
};
