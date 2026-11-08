import { defineContent } from "../content.js";
import { sectorWriter, SEX_CATEGORIES, AGE_CATEGORIES } from "../define.js";

const w = sectorWriter({ sector: "HEALTH", src: "SPHERE_2018" });
const { ind } = w;

w.group("Health systems");
const systems = [
  ind("HLT-S-01", "Qualified health workers per 10,000 people", { def: "Doctors, nurses and midwives for every 10,000 people served.", kind: "RATIO", unit: "per 10,000", agg: "LATEST", dir: "H", level: "OUTCOME", freq: "Quarterly", ref: ["GTE", 22, "per 10,000", "population served", "Health systems: workforce", false], role: "health_workforce_density", std: "Health systems: workforce", mov: ["Staff lists", "Population estimate"] }),
  ind("HLT-S-02", "Health workers trained", { def: "Health staff who completed a training the project ran.", unit: "health workers", freq: "Monthly", dims: ["SEX"], cats: { SEX: SEX_CATEGORIES }, role: "health_workers_trained", rec: true, std: "Health systems: workforce", mov: ["Training attendance lists"] }),
  ind("HLT-S-03", "Health facilities supported", { def: "Facilities that received supplies, repairs, staff support or mentoring from the project.", unit: "facilities", freq: "Monthly", role: "health_facilities_supported", rec: true, std: "Health systems: service delivery", mov: ["Support records"] }),
  ind("HLT-S-04", "Facilities with no stock-out of tracer medicines", { def: "Share of facilities that had none of the agreed tracer medicines out of stock at the time of the visit.", kind: "RATE", dir: "H", level: "OUTPUT", freq: "Monthly", rec: true, std: "Health systems: medicines and supplies", mov: ["Supervision checklists", "Stock cards"] }),
  ind("HLT-S-05", "Facilities reporting weekly on time", { def: "Share of facilities that sent the weekly surveillance report on time.", kind: "RATE", dir: "H", freq: "Weekly", src: "WHO", std: "Health information", mov: ["Surveillance system log"] }),
  ind("HLT-S-06", "Outpatient consultations per person per year", { def: "New outpatient consultations per person in the population served, per year.", kind: "RATIO", unit: "per person per year", agg: "LATEST", dir: "N", freq: "Quarterly", ref: ["BETWEEN", 1, "per person per year", "population served", "Health systems: service delivery", false, 4], std: "Health systems: service delivery", mov: ["Outpatient register"] }),
  ind("HLT-S-07", "Facilities not charging fees at the point of care", { def: "Share of supported facilities that charge no user fees for emergency essential services.", kind: "RATE", dir: "H", std: "Health systems: financing", mov: ["Facility visit"] }),
];
w.group("Mortality and surveillance");
const mortality = [
  ind("HLT-M-01", "Crude mortality rate", { def: "Deaths per 10,000 people per day in the population served.", kind: "RATIO", unit: "per 10,000 per day", agg: "LATEST", dir: "L", level: "GOAL", freq: "Weekly", ref: ["LTE", 1, "per 10,000 per day", "alert level for an emergency", "Essential health services", false], role: "crude_mortality", std: "Essential health services", mov: ["Community death registration", "Surveillance"] }),
  ind("HLT-M-02", "Under-5 mortality rate", { def: "Deaths of children under 5 per 10,000 children under 5 per day.", kind: "RATIO", unit: "per 10,000 per day", agg: "LATEST", dir: "L", level: "GOAL", freq: "Weekly", ref: ["LTE", 2, "per 10,000 per day", "alert level for an emergency", "Essential health services", false], std: "Essential health services", mov: ["Community death registration", "Surveillance"] }),
  ind("HLT-M-03", "Outbreak alerts investigated within 48 hours", { def: "Share of alerts of a notifiable disease that were investigated within 48 hours.", kind: "RATE", dir: "H", freq: "Monthly", src: "WHO", std: "Communicable disease control", mov: ["Alert log"] }),
];
w.group("Communicable diseases and child health");
const child = [
  ind("HLT-C-01", "Children immunised with the vaccines the project supports", { def: "Children who received a vaccine in the period; report each vaccine and dose separately in the breakdown.", unit: "children", dims: ["SEX", "AGE"], cats: { SEX: SEX_CATEGORIES }, freq: "Monthly", role: "children_immunised", rec: true, std: "Child health", mov: ["Vaccination registers"], src: "UNICEF_CCC" }),
  ind("HLT-C-02", "Children 6 months to 15 years vaccinated against measles", { def: "Share of children 6 months to 15 years vaccinated against measles in an area.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per campaign", ref: ["GTE", 95, "%", "children 6 months to 15 years", "Child health", false], std: "Child health", mov: ["Campaign coverage survey"] }),
  ind("HLT-C-03", "Sick children treated under integrated management", { def: "Children under 5 treated for diarrhoea, pneumonia or malaria by a trained provider.", unit: "children", dims: ["SEX"], cats: { SEX: ["Girls", "Boys"] }, freq: "Monthly", src: "WHO", std: "Child health", mov: ["Outpatient register"] }),
  ind("HLT-C-04", "Cholera case fatality", { def: "Share of cholera cases who died.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Weekly", ref: ["LTE", 1, "%", "all cholera cases", "Communicable disease control", false], std: "Communicable disease control", mov: ["Treatment centre records"] }),
  ind("HLT-C-05", "Consultations for communicable diseases of outbreak potential", { def: "Consultations for notifiable diseases (measles, cholera, meningitis, malaria, haemorrhagic fever).", unit: "consultations", dir: "L", freq: "Weekly", std: "Communicable disease control", mov: ["Surveillance data"], dims: ["AGE", "SEX"] }),
];
w.group("Sexual, reproductive and newborn health");
const sexual = [
  ind("HLT-R-01", "Pregnant women attending antenatal care", { def: "Pregnant women who attended at least one antenatal visit in the period.", unit: "women", freq: "Monthly", dims: ["AGE"], role: "pregnant_women_anc", rec: true, std: "Sexual and reproductive health", src: "MISP", mov: ["Antenatal register"] }),
  ind("HLT-R-02", "Births attended by a skilled birth attendant", { def: "Share of births in the area assisted by a doctor, nurse or midwife.", kind: "RATE", num: "Births attended by skilled staff", den: "All births", dir: "H", level: "OUTCOME", freq: "Monthly", role: "skilled_birth_attendance", rec: true, std: "Sexual and reproductive health", src: "MISP", mov: ["Delivery register", "Community estimates"] }),
  ind("HLT-R-03", "Emergency obstetric care facilities per 500,000 people", { def: "Number of basic and comprehensive emergency obstetric care facilities for every 500,000 people.", kind: "RATIO", unit: "facilities per 500,000", agg: "LATEST", dir: "H", freq: "Quarterly", ref: ["GTE", 5, "facilities per 500,000", "4 basic and 1 comprehensive", "Sexual and reproductive health", false], std: "Sexual and reproductive health", src: "MISP", mov: ["Facility assessment"] }),
  ind("HLT-R-04", "Caesarean section births as a share of all births", { def: "Share of births by caesarean section.", kind: "RATE", dir: "N", freq: "Quarterly", ref: ["BETWEEN", 5, "%", "all births", "Sexual and reproductive health", false, 15], std: "Sexual and reproductive health", src: "MISP", mov: ["Delivery register"] }),
  ind("HLT-R-05", "Survivors of sexual violence receiving timely clinical care", { def: "Share of survivors seen who received clinical care within 72 hours (post-exposure prophylaxis) and emergency contraception within 120 hours where it applies.", kind: "RATE", dir: "H", freq: "Monthly", std: "Sexual and reproductive health", src: "MISP", also: ["GBV"], mov: ["Clinical care log (confidential)"] }),
  ind("HLT-R-06", "Women using a modern method of contraception", { def: "Share of women of reproductive age in the area using a modern contraceptive method.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per survey", src: "MISP", mov: ["Household survey"] }),
];
w.group("Injury, mental health and noncommunicable disease");
const other = [
  ind("HLT-T-01", "Injured people treated within the expected time", { def: "Share of trauma patients who received care within the agreed time from arrival.", kind: "RATE", dir: "H", freq: "Monthly", std: "Injury and trauma care", mov: ["Emergency room register"] }),
  ind("HLT-N-01", "People with mental health or psychosocial support contacts", { def: "People who had at least one contact with a mental health or psychosocial support service.", unit: "people", dims: ["SEX", "AGE"], freq: "Monthly", std: "Mental health", src: "IASC", also: ["MHPSS"], mov: ["Service registers"] }),
  ind("HLT-N-02", "People with chronic conditions continuing treatment", { def: "People with diabetes, hypertension or another long-term condition who kept their treatment in the period.", unit: "people", dims: ["SEX", "AGE"], freq: "Monthly", std: "Noncommunicable diseases", mov: ["Chronic care register"] }),
  ind("HLT-A-01", "Attacks on health care recorded", { def: "Reported attacks on health workers, facilities or transport in the area.", unit: "incidents", dir: "L", freq: "Monthly", std: "Health systems: security of health care", mov: ["Incident reports"], src: "WHO" }),
];

export const HEALTH = defineContent({
  sectorId: "HEALTH",
  summary: "Essential health services and health systems in emergencies and recovery, following the Sphere health standards.",
  indicators: [...systems, ...mortality, ...child, ...sexual, ...other],
  dashboardTemplates: ["tpl-health-mnch"],
  logframe: [
    { key: "g", level: "GOAL", title: "Excess illness and death are reduced and people reach essential health services" },
    { key: "o-access", level: "OUTCOME", title: "People use quality essential health services", parent: "g", standards: ["Essential health services"] },
    { key: "o-system", level: "OUTCOME", title: "The health system can keep delivering services", parent: "g", standards: ["Health systems"] },
    { key: "out-mnch", level: "OUTPUT", title: "Maternal, newborn and child services delivered", parent: "o-access" },
    { key: "out-disease", level: "OUTPUT", title: "Diseases prevented, found early and treated", parent: "o-access" },
    { key: "out-staff", level: "OUTPUT", title: "Health workers trained and supported", parent: "o-system" },
    { key: "out-supplies", level: "OUTPUT", title: "Medicines and supplies available at facilities", parent: "o-system" },
  ],
  assessment: [
    { key: "population", question: "How many people are served and what is their age and sex split?", answerType: "NUMBER", unit: "people", why: "Rates and staffing are per population.", required: true },
    { key: "facilities", question: "Which facilities exist, what do they offer, and are they working?", answerType: "TEXT", why: "Shows gaps in care.", required: true },
    { key: "disease-burden", question: "What are the main illnesses and is there any outbreak?", answerType: "TEXT", why: "Sets priorities and the response.", required: true },
    { key: "vaccination", question: "What is the latest vaccination coverage?", answerType: "NUMBER", unit: "%", why: "Identifies outbreak risk.", required: false },
    { key: "referral-path", question: "Where are people referred for hospital care, and how do they get there?", answerType: "TEXT", why: "Access to higher-level care saves lives.", required: true },
  ],
  forms: [
    { key: "surveillance-week", title: "Weekly surveillance report", purpose: "Record weekly cases and deaths of notifiable diseases.", fields: [{ label: "Facility", type: "PLACE", required: true }, { label: "Week ending", type: "DATE", required: true }, { label: "Disease", type: "TEXT", required: true }, { label: "Cases", type: "NUMBER", required: true }, { label: "Deaths", type: "NUMBER", required: true }], feeds: ["HLT-S-05", "HLT-C-05"] },
    { key: "stock-check", title: "Medicines stock check", purpose: "Record the stock of tracer medicines at a facility.", fields: [{ label: "Facility", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Item", type: "TEXT", required: true }, { label: "Balance", type: "NUMBER", required: true }, { label: "Out of stock", type: "YES_NO", required: true }], feeds: ["HLT-S-04"] },
  ],
  evidence: [
    { key: "surveillance-bulletin", name: "Surveillance bulletin", description: "Weekly cases and deaths by disease and facility.", confidentiality: "INTERNAL" },
    { key: "facility-supervision", name: "Facility supervision checklist", description: "Supervisor's findings on services, staff and stock.", confidentiality: "INTERNAL" },
    { key: "vaccination-report", name: "Vaccination campaign report", description: "Doses given, age group and coverage survey.", confidentiality: "INTERNAL" },
    { key: "clinical-gbv-log", name: "Clinical care log for survivors", description: "Minimal, confidential record of care given.", confidentiality: "HIGHLY_SENSITIVE" },
  ],
  checklist: [
    { key: "referral-system", title: "A referral system with transport is in place", description: "Where people are sent, how they get there, and who pays.", severity: "critical", kind: "ATTESTATION", standard: "Health systems: service delivery" },
    { key: "patient-privacy", title: "Patient data are kept private", description: "Records are locked, minimal and shared only as needed.", severity: "high", kind: "ATTESTATION", standard: "Health information" },
    { key: "outbreak-plan", title: "An outbreak preparedness plan exists", description: "Alert thresholds, rapid response team and isolation.", severity: "high", kind: "ATTESTATION", standard: "Communicable disease control" },
  ],
  risks: [
    { title: "Stock-outs of medicines or supplies", kind: "RISK", seriousness: "HIGH", mitigation: "Review stock monthly and reorder early." },
    { title: "A disease outbreak disrupts services", kind: "RISK", seriousness: "MEDIUM", mitigation: "Agree an emergency plan with the local health office." },
    { title: "Health workers leave or cannot reach facilities", kind: "RISK", seriousness: "HIGH", mitigation: "Offer incentives that match the national scheme and plan for cover." },
    { title: "Attacks on health care", kind: "RISK", seriousness: "HIGH", mitigation: "Agree safe access and record incidents." },
  ],
  glossary: [
    { term: "Crude mortality rate", meaning: "Deaths in the whole population per 10,000 people per day." },
    { term: "Tracer medicine", meaning: "A medicine whose stock shows whether the supply system works." },
    { term: "Emergency obstetric care", meaning: "Services that save the life of a mother or newborn during delivery; basic or comprehensive." },
    { term: "IMCI", meaning: "Integrated management of childhood illness, a way to treat common illnesses in young children." },
  ],
  blueprint: [
    { title: "Health service delivery", guidance: "Consultations, immunisation and services reached." },
    { title: "Mortality and disease", guidance: "Mortality rates and outbreaks with thresholds." },
    { title: "Reproductive and newborn health", guidance: "Antenatal care, skilled birth attendance and emergency care." },
    { title: "Health system strengthening", guidance: "Staff, supplies and information." },
  ],
});
