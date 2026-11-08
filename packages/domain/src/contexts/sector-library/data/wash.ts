import { defineContent } from "../content.js";
import { sectorWriter, SEX_CATEGORIES, AGE_CATEGORIES } from "../define.js";

const w = sectorWriter({ sector: "WASH", src: "SPHERE_2018" });
const { ind } = w;

w.group("Hygiene promotion");
const hygiene = [
  ind("WASH-H-01", "People reached by hygiene promotion", { def: "People who took part in at least one hygiene promotion session or visit in the period.", unit: "people", freq: "Monthly", dims: ["SEX", "AGE", "DIS"], cats: { SEX: SEX_CATEGORIES, AGE_GROUP: AGE_CATEGORIES }, role: "hygiene_promotion_reach", rec: true, std: "Hygiene promotion 1.1", mov: ["Session registers", "Household visit logs"] }),
  ind("WASH-H-02", "Households with soap (or ash) and a handwashing station seen", { def: "Share of households visited where a handwashing station with soap or ash was seen by the visitor.", kind: "RATE", num: "Households with soap or ash and a station seen", den: "Households visited", dir: "H", level: "OUTCOME", role: "handwashing_households", rec: true, std: "Hygiene promotion 1.1", mov: ["Household observation checklist"] }),
  ind("WASH-H-03", "Households receiving a hygiene kit", { def: "Households that received the planned hygiene kit (soap, containers and other items on the kit list).", unit: "households", freq: "Per distribution", role: "hygiene_kits", rec: true, std: "Hygiene promotion 1.2", mov: ["Signed distribution lists"] }),
  ind("WASH-H-04", "Women and girls able to manage menstruation with dignity", { def: "Share of women and girls aged 12-49 who report having materials and a private, safe place to manage menstruation.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["AGE"], std: "Hygiene promotion 1.3", mov: ["Household survey", "Focus group notes"] }),
  ind("WASH-H-05", "People who report washing hands at critical times", { def: "Share of surveyed people who name and describe handwashing after toilet use and before eating or preparing food.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Per survey", std: "Hygiene promotion 1.1", mov: ["Knowledge, attitudes and practice survey"] }),
];
w.group("Water supply: access and quantity");
const supply = [
  ind("WASH-W-01", "Average water used per person per day at household level", { def: "Average litres of water used per person per day for drinking, cooking and basic hygiene, measured at household level.", kind: "RATIO", unit: "l/p/d", agg: "AVERAGE", dir: "H", level: "OUTCOME", freq: "Monthly", ref: ["GTE", 15, "l/p/d", "every person served", "Water supply 2.1", true], role: "water_quantity", rec: true, std: "Water supply 2.1", mov: ["Household survey", "Flow and distribution records"] }),
  ind("WASH-W-02", "Longest distance from a household to its nearest water point", { def: "The greatest distance from any household in the site to the nearest water point.", kind: "RATIO", unit: "m", agg: "LATEST", dir: "L", level: "OUTCOME", freq: "Quarterly", ref: ["LTE", 500, "m", "every household", "Water supply 2.1", true], std: "Water supply 2.1", mov: ["Site map", "GPS survey"] }),
  ind("WASH-W-03", "Households within 500 m of a water point", { def: "Share of households whose nearest water point is no more than 500 m away.", kind: "RATE", num: "Households within 500 m", den: "Households in the site", dir: "H", level: "OUTCOME", freq: "Quarterly", std: "Water supply 2.1", mov: ["Site map", "Household survey"] }),
  ind("WASH-W-04", "People per water point", { def: "Number of people served for each functioning water point (tap, hand pump or well), by type.", kind: "RATIO", unit: "people per water point", agg: "LATEST", dir: "L", freq: "Monthly", ref: ["LTE", 250, "people per water point", "per tap", "Water supply 2.1", false], std: "Water supply 2.1", mov: ["Water point register"] }),
  ind("WASH-W-05", "Average time spent queuing at a water point", { def: "Average minutes people wait to collect water at the water points surveyed.", kind: "RATIO", unit: "minutes", agg: "AVERAGE", dir: "L", freq: "Monthly", ref: ["LTE", 30, "minutes", "per visit", "Water supply 2.1", false], std: "Water supply 2.1", mov: ["Observation at water points"] }),
  ind("WASH-W-06", "Water points working", { def: "Share of water points that were working when checked.", kind: "RATE", num: "Water points working", den: "Water points checked", dir: "H", level: "OUTCOME", freq: "Monthly", role: "water_points_functional", rec: true, std: "Water supply 2.3", mov: ["Water point checks"] }),
  ind("WASH-W-07", "People with access to safe water through supported systems", { def: "People who can collect safe water from a system the project built, repaired or runs.", unit: "people", dims: ["SEX", "AGE", "DIS"], level: "OUTCOME", role: "people_basic_water", rec: true, std: "Water supply 2.1", also: ["HEALTH"], mov: ["Water point register", "Household survey"] }),
  ind("WASH-W-08", "Water supply facilities built or rehabilitated", { def: "Water points, systems or sources built or rehabilitated and handed over in working order.", unit: "facilities", freq: "Monthly", role: "water_points_built", rec: true, std: "Water supply 2.3", mov: ["Completion certificates", "Handover records"] }),
  ind("WASH-W-09", "Households with two clean containers for collecting and storing water", { def: "Share of households with a covered, clean container for collecting and another for storing water.", kind: "RATE", dir: "H", freq: "Per distribution", std: "Water supply 2.3", mov: ["Household observation"] }),
];
w.group("Water supply: quality");
const quality = [
  ind("WASH-Q-01", "Water samples with no faecal coliforms at the point of delivery", { def: "Share of water samples with no faecal coliforms per 100 ml, tested at the point of delivery or consumption.", kind: "RATE", num: "Samples with none found", den: "Samples tested", dir: "H", level: "OUTCOME", freq: "Weekly", ref: ["EQ", 100, "%", "samples tested", "Water supply 2.2", false], role: "water_quality", rec: true, std: "Water supply 2.2", mov: ["Water quality test records"] }),
  ind("WASH-Q-02", "Chlorinated water points with a safe chlorine residual", { def: "Share of chlorinated water points where the free chlorine residual is between 0.2 and 0.5 mg/l and turbidity is below 5 NTU.", kind: "RATE", dir: "H", freq: "Weekly", std: "Water supply 2.2", mov: ["Residual chlorine and turbidity records"] }),
  ind("WASH-Q-03", "Sources with a completed sanitary survey and no high risk found", { def: "Share of water sources with a sanitary survey in the period that found no high-risk contamination routes.", kind: "RATE", dir: "H", freq: "Quarterly", std: "Water supply 2.2", mov: ["Sanitary survey forms"] }),
];
w.group("Excreta management");
const sanitation = [
  ind("WASH-S-01", "People per functioning toilet", { def: "Number of people served for each functioning toilet.", kind: "RATIO", unit: "people per toilet", agg: "LATEST", dir: "L", level: "OUTCOME", freq: "Monthly", ref: ["LTE", 20, "people per toilet", "per toilet", "Excreta management 3.2", true], role: "people_per_toilet", rec: true, std: "Excreta management 3.2", mov: ["Toilet register"] }),
  ind("WASH-S-02", "People with access to a safe toilet through supported services", { def: "People who use a toilet the project built, repaired or maintains.", unit: "people", dims: ["SEX", "AGE", "DIS"], level: "OUTCOME", role: "people_basic_sanitation", rec: true, std: "Excreta management 3.2", mov: ["Toilet register", "Household survey"] }),
  ind("WASH-S-03", "Toilets built or rehabilitated", { def: "Toilets or latrines built or rehabilitated and handed over in working order.", unit: "toilets", freq: "Monthly", role: "toilets_built", rec: true, std: "Excreta management 3.2", mov: ["Completion certificates"] }),
  ind("WASH-S-04", "Toilets that are separate by sex, lockable, lit and near dwellings", { def: "Share of toilets that are separate for women and men, lockable from inside, lit, and within about 50 m of the dwellings they serve.", kind: "RATE", dir: "H", freq: "Quarterly", std: "Excreta management 3.2", mov: ["Safety audit", "Toilet inspection"] }),
  ind("WASH-S-05", "Households where people still defecate in the open", { def: "Share of surveyed households where any member reports open defecation.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Per survey", std: "Excreta management 3.1", mov: ["Household survey"] }),
  ind("WASH-S-06", "Pits sited at least 30 m from water sources and 1.5 m above the water table", { def: "Share of new pits that meet the siting distances from groundwater sources and the water table.", kind: "RATE", dir: "H", freq: "At construction", std: "Excreta management 3.2", mov: ["Construction checks"] }),
];
w.group("Vector control and solid waste");
const environment = [
  ind("WASH-V-01", "Households with vector breeding sites in or near the dwelling", { def: "Share of households inspected where a breeding site for flies or mosquitoes was found.", kind: "RATE", dir: "L", freq: "Quarterly", std: "Vector control 4.2", mov: ["Household inspection"] }),
  ind("WASH-X-01", "Households with a safe way to dispose of solid waste", { def: "Share of households with a container or pit within reach and no waste lying around the dwelling.", kind: "RATE", dir: "H", freq: "Quarterly", std: "Solid waste 5.1", mov: ["Household inspection"] }),
];
w.group("WASH in institutions and health outcomes");
const settings = [
  ind("WASH-I-01", "Health facilities meeting WASH minimums", { def: "Share of supported health facilities with safe water, toilets and handwashing meeting the minimum for their size.", kind: "RATE", dir: "H", level: "OUTCOME", also: ["HEALTH"], std: "WASH in health facilities", mov: ["Facility assessment"] }),
  ind("WASH-I-02", "Schools meeting WASH minimums", { def: "Share of supported schools with safe water, separate toilets for girls and boys, and handwashing.", kind: "RATE", dir: "H", level: "OUTCOME", also: ["EDUCATION"], std: "WASH in schools", mov: ["School assessment"] }),
  ind("WASH-D-01", "Cases of acute watery diarrhoea among people served", { def: "Reported cases of acute watery diarrhoea in the population served in the period.", unit: "cases", dir: "L", level: "GOAL", freq: "Weekly", dims: ["AGE", "SEX"], also: ["HEALTH"], std: "WASH outcomes", mov: ["Health facility surveillance"] }),
];

export const WASH = defineContent({
  sectorId: "WASH",
  summary: "Safe water, sanitation and hygiene for people affected by crisis, following the Sphere WASH standards.",
  indicators: [...hygiene, ...supply, ...quality, ...sanitation, ...environment, ...settings],
  dashboardTemplates: ["tpl-wash-access-hygiene"],
  logframe: [
    { key: "g", level: "GOAL", title: "People have equitable, safe and dignified access to water, sanitation and hygiene" },
    { key: "o-water", level: "OUTCOME", title: "People have enough safe water for drinking, cooking and hygiene", parent: "g", standards: ["Water supply 2.1", "Water supply 2.2"] },
    { key: "o-san", level: "OUTCOME", title: "People use safe, clean toilets and the environment is free of human faeces", parent: "g", standards: ["Excreta management 3.1", "Excreta management 3.2"] },
    { key: "o-hyg", level: "OUTCOME", title: "People protect their health through good hygiene practices", parent: "g", standards: ["Hygiene promotion 1.1"] },
    { key: "out-water", level: "OUTPUT", title: "Water supply facilities are built, repaired and kept working", parent: "o-water", standards: ["Water supply 2.1", "Water supply 2.3"] },
    { key: "out-quality", level: "OUTPUT", title: "Water is tested and treated to stay safe", parent: "o-water", standards: ["Water supply 2.2"] },
    { key: "out-toilets", level: "OUTPUT", title: "Toilets are built, safe and used", parent: "o-san", standards: ["Excreta management 3.2"] },
    { key: "out-hyg", level: "OUTPUT", title: "Hygiene sessions held and hygiene items distributed", parent: "o-hyg", standards: ["Hygiene promotion 1.2"] },
  ],
  assessment: [
    { key: "pop-site", question: "How many people and households live in each site?", answerType: "NUMBER", unit: "people", why: "Quantities and targets are set per person.", required: true },
    { key: "water-now", question: "How much water does each person have per day now?", answerType: "NUMBER", unit: "l/p/d", why: "Sets the gap to the 15 litres minimum.", required: true },
    { key: "sources", question: "What are the main water sources and are they safe to drink?", answerType: "TEXT", why: "Decides treatment and testing.", required: true },
    { key: "toilets-now", question: "How many working toilets are there, and how many people use each?", answerType: "NUMBER", why: "Sets the gap to 20 people per toilet.", required: true },
    { key: "hyg-practice", question: "Do households have soap and a place to wash hands?", answerType: "YES_NO", why: "Decides hygiene items and sessions.", required: false },
    { key: "disease", question: "Is there an outbreak of diarrhoeal disease?", answerType: "YES_NO", why: "Changes priorities and surveillance.", required: false },
    { key: "season", question: "When are the rainy and dry seasons?", answerType: "TEXT", why: "Floods and drought affect construction and quality.", required: false },
  ],
  forms: [
    { key: "water-point", title: "Water point check", purpose: "Record the state of a water point and the people it serves.", fields: [{ label: "Water point", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Working today", type: "YES_NO", required: true }, { label: "People served", type: "NUMBER", required: false }, { label: "Photo", type: "PHOTO", required: false }], feeds: ["WASH-W-06"] },
    { key: "water-test", title: "Water quality test", purpose: "Record a test result at the point of delivery.", fields: [{ label: "Water point", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Faecal coliforms per 100 ml", type: "NUMBER", required: true }, { label: "Free chlorine residual (mg/l)", type: "NUMBER", required: false }, { label: "Turbidity (NTU)", type: "NUMBER", required: false }], feeds: ["WASH-Q-01", "WASH-Q-02"] },
    { key: "hygiene-session", title: "Hygiene session", purpose: "Record who attended a hygiene promotion session.", fields: [{ label: "Place", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Topic", type: "TEXT", required: true }, { label: "Women", type: "NUMBER", required: true }, { label: "Men", type: "NUMBER", required: true }, { label: "Girls", type: "NUMBER", required: true }, { label: "Boys", type: "NUMBER", required: true }], feeds: ["WASH-H-01"] },
  ],
  evidence: [
    { key: "water-test-result", name: "Water quality test result", description: "Laboratory or field test record for a water point.", confidentiality: "INTERNAL" },
    { key: "sanitary-survey", name: "Sanitary survey form", description: "Inspection of a source's surroundings and contamination routes.", confidentiality: "INTERNAL" },
    { key: "completion-certificate", name: "Completion certificate", description: "Signed handover of a built or repaired facility.", confidentiality: "INTERNAL" },
    { key: "distribution-list", name: "Signed distribution list", description: "Hygiene kit or item distribution with household signatures.", confidentiality: "SENSITIVE" },
    { key: "safety-audit", name: "Safety audit", description: "Check of water points and toilets for women's and girls' safety.", confidentiality: "SENSITIVE" },
  ],
  checklist: [
    { key: "water-testing-plan", title: "A water testing plan is in place", description: "Who tests which sources, how often, and what is done on a failed test.", severity: "high", kind: "ATTESTATION", standard: "Water supply 2.2" },
    { key: "hygiene-items-list", title: "The hygiene item list was agreed with the people it is for", description: "Items, quantities and the menstrual hygiene materials chosen with women and girls.", severity: "medium", kind: "ATTESTATION", standard: "Hygiene promotion 1.2" },
    { key: "wash-safety-audit", title: "A safety audit of water points and toilets was done", description: "Locations, lighting and locks checked with women and girls.", severity: "high", kind: "ATTESTATION", standard: "Excreta management 3.2" },
  ],
  risks: [
    { title: "A water source becomes contaminated", kind: "RISK", seriousness: "HIGH", mitigation: "Test often, chlorinate, and keep a plan for trucking or treatment." },
    { title: "Floods or drought delay construction", kind: "RISK", seriousness: "HIGH", mitigation: "Plan construction for the dry season and keep a buffer." },
    { title: "Women and girls feel unsafe using toilets or water points", kind: "PROBLEM", seriousness: "HIGH", mitigation: "Place facilities near homes, add lighting and locks, and audit with women and girls." },
    { title: "Water points are not maintained after handover", kind: "RISK", seriousness: "MEDIUM", mitigation: "Train a committee, agree a fee and keep spare parts locally." },
  ],
  glossary: [
    { term: "Faecal coliforms", meaning: "Bacteria from human or animal waste; any found in drinking water means it may be unsafe." },
    { term: "Free chlorine residual", meaning: "The chlorine left in water after treatment, which keeps it safe on the way to the user." },
    { term: "Turbidity (NTU)", meaning: "How cloudy the water is; cloudy water makes chlorine work less well." },
    { term: "Sanitary survey", meaning: "An inspection of a water source and its surroundings to find ways it could become contaminated." },
    { term: "Open defecation", meaning: "Going to the toilet in fields, bushes, water or other open places." },
  ],
  blueprint: [
    { title: "Water supply results", guidance: "Litres per person per day, distance, queuing time and water points working." },
    { title: "Water quality", guidance: "Test results and what was done about failures." },
    { title: "Sanitation results", guidance: "People per toilet, safety and use." },
    { title: "Hygiene promotion results", guidance: "People reached, items distributed and observed practice." },
  ],
});
