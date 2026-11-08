import { defineContent } from "../content.js";
import { sectorWriter, SEX_CATEGORIES } from "../define.js";

const w = sectorWriter({ sector: "NUTRITION", src: "SPHERE_2018" });
const { ind } = w;
const child = ["Girls", "Boys"] as const;

w.group("Nutrition assessment and surveillance");
const assessment = [
  ind("NUT-A-01", "Global acute malnutrition among children 6-59 months", { def: "Share of children 6-59 months with weight-for-height below -2 z-scores, or MUAC below 125 mm, or nutritional oedema.", kind: "RATE", num: "Children 6-59 months acutely malnourished", den: "Children 6-59 months measured", dir: "L", level: "OUTCOME", freq: "Per survey", dims: ["SEX"], cats: { SEX: child }, src: "SMART", std: "Acute malnutrition prevalence", mov: ["SMART or equivalent nutrition survey"], role: "gam_prevalence", rec: true, tags: ["gam", "who thresholds"] }),
  ind("NUT-A-02", "Severe acute malnutrition among children 6-59 months", { def: "Share of children 6-59 months with weight-for-height below -3 z-scores, or MUAC below 115 mm, or nutritional oedema.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Per survey", dims: ["SEX"], cats: { SEX: child }, src: "SMART", mov: ["Nutrition survey"] }),
  ind("NUT-A-03", "Acute malnutrition among pregnant and lactating women (MUAC)", { def: "Share of pregnant and lactating women measured whose MUAC is below the cut-off used in the programme.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Per survey", mov: ["MUAC screening records", "Nutrition survey"] }),
  ind("NUT-A-04", "Children 6-59 months screened for acute malnutrition", { def: "Children 6-59 months measured by MUAC or weight-for-height in screening.", unit: "children", dims: ["SEX"], cats: { SEX: child }, freq: "Monthly", role: "children_screened", rec: true, std: "Management of acute malnutrition", mov: ["Screening registers"] }),
];
w.group("Management of acute malnutrition");
const treatment = [
  ind("NUT-T-01", "Children admitted for treatment of severe acute malnutrition", { def: "New admissions of children 6-59 months to SAM treatment.", unit: "children", dims: ["SEX"], cats: { SEX: child }, freq: "Monthly", role: "sam_admissions", rec: true, std: "Management of acute malnutrition 3.2", mov: ["Admission register"] }),
  ind("NUT-T-02", "Children admitted for treatment of moderate acute malnutrition", { def: "New admissions of children 6-59 months to MAM treatment or supplementary feeding.", unit: "children", dims: ["SEX"], cats: { SEX: child }, freq: "Monthly", role: "mam_admissions", rec: true, std: "Management of acute malnutrition 3.1", mov: ["Admission register"] }),
  ind("NUT-T-03", "Cure (recovery) rate in SAM treatment", { def: "Share of exits from SAM treatment who recovered.", kind: "RATE", num: "Exits recovered", den: "All exits", dir: "H", level: "OUTCOME", freq: "Monthly", ref: ["GTE", 75, "%", "per treatment programme", "Management of acute malnutrition 3.2", false], role: "sam_cure_rate", rec: true, std: "Management of acute malnutrition 3.2", mov: ["Monthly programme report"] }),
  ind("NUT-T-04", "Death rate in SAM treatment", { def: "Share of exits from SAM treatment who died.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Monthly", ref: ["LTE", 10, "%", "per treatment programme", "Management of acute malnutrition 3.2", false], std: "Management of acute malnutrition 3.2", mov: ["Monthly programme report"] }),
  ind("NUT-T-05", "Default (drop-out) rate in SAM treatment", { def: "Share of exits from SAM treatment who left without completing treatment.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Monthly", ref: ["LTE", 15, "%", "per treatment programme", "Management of acute malnutrition 3.2", false], std: "Management of acute malnutrition 3.2", mov: ["Monthly programme report"] }),
  ind("NUT-T-06", "Cure (recovery) rate in MAM treatment", { def: "Share of exits from MAM treatment who recovered.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Monthly", std: "Management of acute malnutrition 3.1", mov: ["Monthly programme report"] }),
  ind("NUT-T-07", "Treatment programme coverage", { def: "Share of children in need of treatment who are in the programme at the time of a coverage survey.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per survey", ref: ["GTE", 50, "%", "rural programmes", "Management of acute malnutrition 3.2", false], std: "Management of acute malnutrition 3.2", mov: ["Coverage survey"] }),
  ind("NUT-T-08", "Sites with no stock-out of therapeutic or supplementary food", { def: "Share of treatment sites that had no stock-out of RUTF or RUSF in the period.", kind: "RATE", dir: "H", freq: "Monthly", mov: ["Stock records"] }),
];
w.group("Infant and young child feeding");
const feeding = [
  ind("NUT-F-01", "Infants under 6 months exclusively breastfed", { def: "Share of infants 0-5 months who were fed only breast milk in the previous 24 hours.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per survey", std: "Infant and young child feeding 2.2", mov: ["Household survey"], role: "exclusive_breastfeeding" }),
  ind("NUT-F-02", "Children 6-23 months with a minimum acceptable diet", { def: "Share of children 6-23 months who ate the minimum number of meals and food groups for their age.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per survey", std: "Infant and young child feeding 2.2", mov: ["Household survey"] }),
  ind("NUT-F-03", "Caregivers reached with infant and young child feeding counselling", { def: "Mothers and other caregivers of children under 2 who received counselling or took part in a support group.", unit: "caregivers", freq: "Monthly", dims: ["SEX"], role: "iycf_counselling", rec: true, std: "Infant and young child feeding 2.2", mov: ["Counselling registers"] }),
  ind("NUT-F-04", "Breast-milk substitutes distributed outside the national or International Code framework", { def: "Quantity or number of times breast-milk substitutes were given out without meeting the Code or national rules.", unit: "distributions", dir: "L", freq: "Monthly", ref: ["EQ", 0, "distributions", "all", "Infant and young child feeding 2.1", false], std: "Infant and young child feeding 2.1", mov: ["Distribution records"] }),
];
w.group("Micronutrients and pregnancy");
const micro = [
  ind("NUT-M-01", "Children 6-59 months who received vitamin A", { def: "Children 6-59 months who received a vitamin A supplement in the period.", unit: "children", dims: ["SEX"], cats: { SEX: child }, freq: "Per campaign", std: "Micronutrient deficiencies 3.3", mov: ["Campaign tally sheets"] }),
  ind("NUT-M-02", "Pregnant and lactating women receiving micronutrient supplements", { def: "Pregnant and lactating women who received iron-folate or multiple micronutrient supplements.", unit: "women", freq: "Monthly", std: "Micronutrient deficiencies 3.3", mov: ["Antenatal and postnatal registers"], also: ["HEALTH"] }),
  ind("NUT-M-03", "Children 6-59 months screened and referred to the right service", { def: "Share of children found acutely malnourished in screening who were referred to treatment.", kind: "RATE", dir: "H", freq: "Monthly", mov: ["Referral slips", "Admission register"] }),
];

export const NUTRITION = defineContent({
  sectorId: "NUTRITION",
  summary: "Preventing and treating acute malnutrition and supporting good infant and young child feeding, following the Sphere nutrition standards.",
  indicators: [...assessment, ...treatment, ...feeding, ...micro],
  dashboardTemplates: ["tpl-nutrition-screening-treatment"],
  logframe: [
    { key: "g", level: "GOAL", title: "Acute malnutrition and its risk are reduced among children and women" },
    { key: "o-treat", level: "OUTCOME", title: "Children with acute malnutrition are treated and recover", parent: "g", standards: ["Management of acute malnutrition 3.1", "Management of acute malnutrition 3.2"] },
    { key: "o-feed", level: "OUTCOME", title: "Infants and young children are fed appropriately", parent: "g", standards: ["Infant and young child feeding 2.2"] },
    { key: "out-screen", level: "OUTPUT", title: "Children and women are screened and referred", parent: "o-treat" },
    { key: "out-treat", level: "OUTPUT", title: "Treatment sites run with supplies and trained staff", parent: "o-treat" },
    { key: "out-iycf", level: "OUTPUT", title: "Caregivers receive feeding counselling and support", parent: "o-feed" },
  ],
  assessment: [
    { key: "gam-now", question: "What is the latest acute malnutrition prevalence and when was it measured?", answerType: "TEXT", why: "Sets the severity and the priority.", required: true },
    { key: "children-u5", question: "How many children 6-59 months and pregnant or lactating women are in the area?", answerType: "NUMBER", unit: "people", why: "Sizes screening and treatment.", required: true },
    { key: "supply", question: "How is therapeutic and supplementary food supplied, and who holds stock?", answerType: "TEXT", why: "A broken supply line stops treatment.", required: true },
    { key: "referral", question: "Where are children with complications referred?", answerType: "TEXT", why: "Severe cases need inpatient care.", required: true },
    { key: "iycf-practice", question: "What are the common feeding practices for infants under 2?", answerType: "TEXT", why: "Shapes counselling and what to avoid.", required: false },
  ],
  forms: [
    { key: "screening", title: "Nutrition screening", purpose: "Record a child's or woman's measurements and the decision.", fields: [{ label: "Date", type: "DATE", required: true }, { label: "Place", type: "PLACE", required: true }, { label: "Age in months", type: "NUMBER", required: true }, { label: "MUAC (mm)", type: "NUMBER", required: true }, { label: "Oedema", type: "YES_NO", required: true }, { label: "Referred to treatment", type: "YES_NO", required: true }], feeds: ["NUT-A-04", "NUT-M-03"] },
    { key: "programme-month", title: "Monthly treatment report", purpose: "Record a month's admissions and exits for a treatment site.", fields: [{ label: "Site", type: "PLACE", required: true }, { label: "Month", type: "DATE", required: true }, { label: "Admissions", type: "NUMBER", required: true }, { label: "Cured", type: "NUMBER", required: true }, { label: "Died", type: "NUMBER", required: true }, { label: "Defaulted", type: "NUMBER", required: true }, { label: "Non-responders", type: "NUMBER", required: true }], feeds: ["NUT-T-01", "NUT-T-03", "NUT-T-04", "NUT-T-05"] },
  ],
  evidence: [
    { key: "nutrition-survey", name: "Nutrition survey report", description: "Survey methods, sample and results for acute malnutrition.", confidentiality: "INTERNAL" },
    { key: "admission-register", name: "Admission and discharge register", description: "Individual treatment records; contains personal data.", confidentiality: "HIGHLY_SENSITIVE" },
    { key: "monthly-programme-report", name: "Monthly programme report", description: "Admissions, cured, died, defaulted, non-responders.", confidentiality: "INTERNAL" },
    { key: "stock-record", name: "Stock record", description: "Therapeutic and supplementary food received, used and in stock.", confidentiality: "INTERNAL" },
  ],
  checklist: [
    { key: "referral-pathway", title: "A referral pathway for complicated cases is agreed", description: "Where children with medical complications are sent and how.", severity: "critical", kind: "ATTESTATION", standard: "Management of acute malnutrition 3.2" },
    { key: "code-compliance", title: "No breast-milk substitutes are given out outside the Code", description: "The team knows the International Code and national rules.", severity: "high", kind: "ATTESTATION", standard: "Infant and young child feeding 2.1" },
  ],
  risks: [
    { title: "Therapeutic food supply breaks", kind: "RISK", seriousness: "HIGH", mitigation: "Hold a buffer stock and track consumption weekly." },
    { title: "Families cannot reach treatment sites", kind: "PROBLEM", seriousness: "MEDIUM", mitigation: "Run outreach screening and treatment close to homes." },
    { title: "Seasonal peak in malnutrition", kind: "ASSUMPTION", seriousness: "MEDIUM", mitigation: "Scale up screening and stock before the lean season." },
  ],
  glossary: [
    { term: "MUAC", meaning: "Mid-upper arm circumference, a quick arm measurement used to find acute malnutrition." },
    { term: "SAM and MAM", meaning: "Severe and moderate acute malnutrition: a child very or somewhat too thin for their height." },
    { term: "RUTF", meaning: "Ready-to-use therapeutic food, a high-energy paste used to treat severe acute malnutrition." },
    { term: "IYCF", meaning: "Infant and young child feeding: breastfeeding and the foods given to children under two." },
  ],
  blueprint: [
    { title: "Nutrition status", guidance: "Survey and screening results against thresholds." },
    { title: "Treatment performance", guidance: "Cure, death and default rates and coverage." },
    { title: "Infant and young child feeding", guidance: "Counselling reached and practice changes." },
  ],
});
