import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const h = sectorWriter({ sector: "HLP", src: "UNHCR_RBM" });
h.group("Housing, land and property rights");
export const HLP = defineContent({
  sectorId: "HLP",
  summary: "Securing people's rights to housing, land and property, and preventing forced eviction.",
  indicators: [
    h.ind("HLP-01", "People receiving HLP legal counselling or information", { def: "People who received counselling, information or legal help on housing, land and property.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "hlp_counselling", rec: true, mov: ["Counselling register"] }),
    h.ind("HLP-02", "HLP disputes resolved through mediation or legal means", { def: "HLP disputes that reached a documented, agreed resolution.", unit: "disputes", role: "hlp_disputes_resolved", rec: true, mov: ["Case records"] }),
    h.ind("HLP-03", "Households with documented tenure or occupancy rights", { def: "Households holding a document or agreement that proves their right to the home or land.", unit: "households", role: "hlp_tenure_docs", rec: true, mov: ["Tenure documents"], also: ["SHELTER_NFI"] }),
    h.ind("HLP-04", "Women with secure tenure in their own name or jointly", { def: "Women holding tenure rights in their own name or jointly with others.", unit: "women", mov: ["Tenure documents"], also: ["GENDER_EQUALITY"] }),
    h.ind("HLP-05", "Forced evictions prevented or stopped", { def: "Threatened or planned evictions that were stopped or delayed after intervention.", unit: "evictions", mov: ["Monitoring reports"], dir: "H" }),
    h.ind("HLP-06", "Communities trained on HLP rights", { def: "People trained on their housing, land and property rights and how to claim them.", unit: "people", dims: ["SEX"], mov: ["Training lists"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People hold secure rights to their housing, land and property" }, { key: "o-secure", level: "OUTCOME", title: "Households have documented, secure tenure", parent: "g" }, { key: "out-legal", level: "OUTPUT", title: "Legal counselling and mediation provided", parent: "o-secure" }],
  assessment: [{ key: "tenure-types", question: "Which forms of tenure exist and which are at risk?", answerType: "TEXT", why: "Targeting and approach depend on it.", required: true }],
  forms: [], evidence: [{ key: "tenure-doc", name: "Tenure or occupancy document", description: "Proof of the right to the home or land.", confidentiality: "HIGHLY_SENSITIVE" }],
  checklist: [], risks: [{ title: "Documents are lost or contested", kind: "RISK", seriousness: "MEDIUM", mitigation: "Keep certified copies and involve local authorities." }],
  glossary: [{ term: "Tenure", meaning: "The right to use, occupy or own housing or land." }],
  blueprint: [{ title: "Housing, land and property results", guidance: "Counselling, disputes resolved and secure tenure." }],
  noneBecause: { forms: "HLP work is case-based and recorded in confidential case files rather than a collection form.", checklist: "Covered by the common protection checklist." },
});

const m = sectorWriter({ sector: "MINE_ACTION", src: "IMAS" });
m.group("Explosive ordnance risk");
export const MINE_ACTION = defineContent({
  sectorId: "MINE_ACTION",
  summary: "Clearing explosive hazards, educating people on risks and supporting survivors.",
  indicators: [
    m.ind("MA-01", "Area cleared of explosive hazards", { def: "Square metres of land released through clearance, technical survey or non-technical survey.", unit: "m²", role: "area_cleared", rec: true, mov: ["Handover certificates", "Task completion reports"] }),
    m.ind("MA-02", "Explosive items found and destroyed", { def: "Explosive items found and destroyed, by type.", unit: "items", role: "items_destroyed", rec: true, mov: ["Demolition records"] }),
    m.ind("MA-03", "People reached by explosive ordnance risk education", { def: "People who took part in risk education sessions.", unit: "people", dims: ["SEX", "AGE"], role: "eore_reach", rec: true, mov: ["Session registers"] }),
    m.ind("MA-04", "People benefiting from released land", { def: "People who can use land or routes released from hazard.", unit: "people", role: "land_beneficiaries", mov: ["Community records"], level: "OUTCOME" }),
    m.ind("MA-05", "Survivors of explosive accidents receiving assistance", { def: "Survivors and families who received medical, rehabilitation, psychosocial or livelihood support.", unit: "people", dims: ["SEX", "AGE"], mov: ["Case records (confidential)"] }),
    m.ind("MA-06", "Casualties from explosive ordnance in the area", { def: "People killed or injured by explosive ordnance in the area in the period.", unit: "people", dir: "L", level: "GOAL", dims: ["SEX", "AGE"], mov: ["Casualty database"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People live and move safely without explosive ordnance risk" }, { key: "o-land", level: "OUTCOME", title: "Safe land and routes are available for use", parent: "g" }, { key: "out-clear", level: "OUTPUT", title: "Hazardous areas surveyed and cleared", parent: "o-land" }, { key: "out-eore", level: "OUTPUT", title: "People educated on explosive ordnance risks", parent: "o-land" }],
  assessment: [{ key: "contamination", question: "What is known about contamination: type, location and who is at risk?", answerType: "TEXT", why: "Prioritises tasks.", required: true }],
  forms: [], evidence: [{ key: "ma-completion", name: "Task completion and handover report", description: "Quality-assured clearance records.", confidentiality: "INTERNAL" }],
  checklist: [{ key: "ma-qa", title: "Clearance follows national and international standards with quality assurance", description: "Work is accredited and inspected.", severity: "critical", kind: "ATTESTATION", standard: "IMAS" }],
  risks: [{ title: "Accident during operations", kind: "RISK", seriousness: "HIGH", mitigation: "Follow standard operating procedures, medical cover and training." }],
  glossary: [{ term: "Land release", meaning: "The process of returning land to use after survey or clearance." }],
  blueprint: [{ title: "Land release and clearance", guidance: "Area released, items found and handed over." }],
  noneBecause: { forms: "Mine action data are kept in specialist information systems; the project records totals.", dashboards: "Too few counts for a standard dashboard; use the sector scorecard canvas." },
});
