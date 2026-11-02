// A draft in which every wizard requirement holds, for tests that need a finished setup.
import { emptyDraft, planKeyOf, budgetKeyOf, SUPPORT_LINE } from "@donordesk/domain";

const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const person = (key, role) => ({ key, name: key, email: null, role, external: false, invite: "LATER" });

export function completeDraftForTest() {
  const d = emptyDraft(false);
  const f = d.proposal.facts;
  f.name = item("WASH Gulu"); f.code = item("WG-1"); f.startDate = item("2026-01-01"); f.endDate = item("2027-12-31"); f.currency = item("EUR");
  d.proposal.logframe = [
    item({ level: "OUTCOME", code: "OC1", title: "Safe water", description: null, parentCode: null, codeSource: "DOCUMENT" }),
    item({ level: "OUTPUT", code: "OP1", title: "Wells built", description: null, parentCode: "OC1", codeSource: "DOCUMENT" }),
    item({ level: "ACTIVITY", code: "A1", title: "Drill wells", description: null, parentCode: "OP1", codeSource: "DOCUMENT" }),
  ];
  d.proposal.indicators = [item({ code: "I1", title: "Wells", logframeCode: "OP1", type: "NUMBER", unit: "wells", baseline: "0", target: "20", targetSchedule: null, frequency: "MONTHLY", direction: null, disaggregation: null, meansOfVerification: null })];
  d.proposal.plan = [item({ title: "Drill wells", logframeCode: "A1", start: "2026-02-01", end: "2026-06-30", location: null, lead: null, planCode: "1.1" })];
  d.proposal.places = [item({ name: "Gulu", adminLevel: 2, parentName: null, latitude: null, longitude: null })];
  d.proposal.funding = [item({ sourceName: "EU", amount: "100000", currency: "EUR" })];
  d.proposal.budget = [item({ category: "Wells", amount: "100000", currency: "EUR", logframeCode: null, kind: "LINE" })];
  d.proposal.risks = [item({ kind: "RISK", title: "Floods", seriousness: "MEDIUM", mitigation: "Plan early" }), item({ kind: "ASSUMPTION", title: "Roads stay open", seriousness: "LOW", mitigation: null })];
  const e = d.extras;
  e.start = { donor: "EU", sector: "WASH", country: "Uganda", withDocuments: false };
  e.team = [person("pm", "PROJECT_MANAGER"), person("me", "ME_OFFICER"), person("fo", "FIELD_OFFICER"), { ...person("ngo", "FIELD_OFFICER"), external: true }];
  e.indicatorSetup = { I1: { ownerKey: "me", method: "FORM", directionConfirmed: true } };
  e.planSetup = { [planKeyOf({ planCode: "1.1", title: "Drill wells", start: "2026-02-01" })]: { placeNames: ["Gulu"], projectWide: false, indicatorCodes: ["I1"], leadKey: "fo", requiredFiles: [], recordsParticipants: false } };
  e.projectArea = "Gulu District";
  e.collection = { reviewMode: "SIMPLE", windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 } };
  e.schedule = { cadence: "QUARTERLY", reminders: true, rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }] };
  e.finance = { reportingCurrency: "EUR", differenceAcknowledged: false, budgetPlan: { [budgetKeyOf({ category: "Wells", amount: "100000" })]: SUPPORT_LINE } };
  e.dashboardTemplate = "tpl-wash-access-hygiene";
  return d;
}
