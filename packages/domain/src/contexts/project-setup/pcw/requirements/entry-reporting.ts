/** Requirements of slides 7 (Data entry system) and 8 (Reporting schedule). */
import type { RequirementDef } from "../requirement.js";
import { MET, allOf, live, open, present } from "./shared.js";

export const ENTRY_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "entry.methods", slide: "DATA_ENTRY", coversSteps: [30, 31, 32], allowsNotUsed: false,
    check: (d) => allOf(live(d.proposal.indicators).filter((i) => i.code === null || d.extras.indicatorSetup[i.code]?.method === undefined).map((i) => i.code ?? i.title ?? "?"), "methodMissing"),
  },
  {
    key: "entry.review", slide: "DATA_ENTRY", coversSteps: [15], allowsNotUsed: false,
    check: (d) => {
      const c = d.extras.collection;
      if (c.reviewMode === undefined) return open("reviewModeMissing");
      if (c.windowRule === undefined) return open("windowRuleMissing");
      // Who verifies follows people's roles on the project, so no named verifier is asked for.
      return MET;
    },
  },
];

export const REPORTING_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "reporting.cadence", slide: "REPORTING", coversSteps: [12], allowsNotUsed: false,
    check: (d) => (present(d.extras.schedule.cadence) || live(d.proposal.periods).some((p) => present(p.type)) ? MET : open("cadenceMissing")),
  },
  {
    key: "reporting.rules", slide: "REPORTING", coversSteps: [5, 13, 14, 42], allowsNotUsed: false,
    check: (d) => {
      const rules = d.extras.schedule.rules;
      if (rules.length === 0) return open("reportRulesMissing");
      // Who approves a report follows people's roles on the project, so only the layout and the due date are asked for.
      const problems = rules
        .filter((r) => !present(r.template) || r.dueDaysAfterEnd === null)
        .map((r) => r.reportType);
      return allOf(problems, "reportRuleIncomplete");
    },
  },
];
