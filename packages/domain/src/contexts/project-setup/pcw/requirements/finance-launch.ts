/** Requirements of slides 9 (Budget and finance) and 10 (Review and launch). */
import { budgetKeyOf } from "../draft.js";
import { budgetTotalRows, financeSummary } from "../finance-summary.js";
import type { RequirementDef } from "../requirement.js";
import { MET, allOf, live, open, present, undecidedCount } from "./shared.js";

/** Answering the funding requirement "not used" switches the whole finance slide off. */
const FINANCE_SWITCH = "finance.funding";

export const FINANCE_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: FINANCE_SWITCH, slide: "FINANCE", coversSteps: [25, 28], allowsNotUsed: true,
    check: (d) => (live(d.proposal.funding).some((f) => present(f.amount) && present(f.currency)) ? MET : open("fundingMissing")),
  },
  {
    key: "finance.budget", slide: "FINANCE", coversSteps: [26], allowsNotUsed: true, unlessNotUsed: FINANCE_SWITCH,
    check: (d) => {
      const pending = undecidedCount(d.proposal.budget);
      if (pending > 0) return open("budgetUndecided", { count: pending });
      return allOf(budgetTotalRows(d).filter((b) => d.extras.finance.budgetPlan[budgetKeyOf(b)] === undefined).map((b) => b.category ?? b.ref ?? "?"), "budgetLineUnlinked");
    },
  },
  {
    key: "finance.reconcile", slide: "FINANCE", coversSteps: [27], allowsNotUsed: true, unlessNotUsed: FINANCE_SWITCH,
    check: (d) => {
      if (!present(d.extras.finance.reportingCurrency)) return open("reportingCurrencyMissing");
      const summary = financeSummary(d);
      const agrees = summary.differences.length === 0 && !summary.statedTotalMismatch;
      return agrees || d.extras.finance.differenceAcknowledged ? MET : open("budgetDiffers");
    },
  },
];

export const LAUNCH_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "launch.risks", slide: "LAUNCH", coversSteps: [38], allowsNotUsed: true,
    check: (d) => {
      const n = undecidedCount(d.proposal.risks);
      if (n > 0) return open("risksUndecided", { count: n });
      if (live(d.proposal.risks).length === 0) return open("risksMissing");
      // An entry with no rating would be left out when the project starts, so it holds the slide open instead of vanishing.
      return allOf(live(d.proposal.risks).filter((r) => !present(r.seriousness)).map((r) => r.title ?? "?"), "risksUnrated");
    },
  },
  {
    // An assumption is a kind of risk ("we are assuming"); the logframe has no field for them.
    key: "launch.assumptions", slide: "LAUNCH", coversSteps: [11], allowsNotUsed: true,
    check: (d) => (live(d.proposal.risks).some((r) => r.kind === "ASSUMPTION") ? MET : open("assumptionsMissing")),
  },
  {
    key: "launch.dashboard", slide: "LAUNCH", coversSteps: [40, 41], allowsNotUsed: true,
    check: (d) => (present(d.extras.dashboardTemplate) ? MET : open("dashboardMissing")),
  },
];
