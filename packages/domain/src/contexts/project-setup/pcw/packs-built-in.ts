/**
 * The packs that ship with DonorDesk (Phase 38): a generic one and three sectors. They are starting answers, not rules — every
 * value can be changed on its slide — and they name no donor. Adding a sector is a row here; nothing branches on a sector name.
 * Wording of the risks is plain language for the people who will read it in the project.
 */
import type { DefaultPack, PackReportRule } from "./packs.js";

const QUARTERLY_RULES: readonly PackReportRule[] = [
  { reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 },
  { reportType: "ANNUAL", template: "BUILT_IN", dueDaysAfterEnd: 45 },
  { reportType: "FINAL", template: "BUILT_IN", dueDaysAfterEnd: 60 },
];

const common = {
  source: "BUILT_IN" as const,
  cadence: "QUARTERLY",
  reportRules: QUARTERLY_RULES,
  reviewMode: "FULL" as const,
  windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 },
};

export const BUILT_IN_PACKS: readonly DefaultPack[] = [
  {
    ...common, id: "builtin:generic", sector: null, label: "General project",
    risks: [
      { kind: "RISK", title: "Key staff leave during the project", seriousness: "MEDIUM", mitigation: "Keep a handover note for every role." },
      { kind: "RISK", title: "Funds arrive later than planned", seriousness: "MEDIUM", mitigation: "Agree a payment calendar with the donor." },
    ],
  },
  {
    ...common, id: "builtin:health", sector: "HEALTH", label: "Health", dashboardTemplate: "tpl-health-mnch",
    risks: [
      { kind: "RISK", title: "Medicine or supply stock-outs", seriousness: "HIGH", mitigation: "Review stock monthly and reorder early." },
      { kind: "RISK", title: "A disease outbreak disrupts services", seriousness: "MEDIUM", mitigation: "Agree an emergency plan with the local health office." },
    ],
  },
  {
    ...common, id: "builtin:wash", sector: "WASH", label: "Water, sanitation and hygiene", dashboardTemplate: "tpl-wash-access-hygiene",
    risks: [
      { kind: "RISK", title: "Seasonal floods or drought delay construction", seriousness: "HIGH", mitigation: "Schedule construction in the dry season." },
      { kind: "RISK", title: "Water points are not maintained after handover", seriousness: "MEDIUM", mitigation: "Train a community committee and agree a fee." },
    ],
  },
  {
    ...common, id: "builtin:nutrition", sector: "NUTRITION", label: "Nutrition", dashboardTemplate: "tpl-nutrition-screening-treatment",
    cadence: "MONTHLY",
    reportRules: [{ reportType: "MONTHLY", template: "BUILT_IN", dueDaysAfterEnd: 10 }, ...QUARTERLY_RULES],
    risks: [
      { kind: "RISK", title: "Therapeutic food supply breaks", seriousness: "HIGH", mitigation: "Hold a buffer stock and track consumption weekly." },
      { kind: "RISK", title: "Families cannot reach the treatment site", seriousness: "MEDIUM", mitigation: "Run outreach screening in remote areas." },
    ],
  },
];
