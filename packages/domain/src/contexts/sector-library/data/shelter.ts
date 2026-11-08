import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const w = sectorWriter({ sector: "SHELTER_NFI", src: "SPHERE_2018" });
const { ind } = w;

w.group("Shelter: strategy, space and construction");
const shelter = [
  ind("SH-S-01", "Households receiving shelter assistance", { def: "Households that received shelter materials, a kit, a repair, a rental subsidy or a transitional shelter.", unit: "households", freq: "Monthly", dims: ["LOC"], role: "households_shelter", rec: true, std: "Shelter and settlement strategy", mov: ["Distribution and completion records"] }),
  ind("SH-S-02", "Covered living area per person", { def: "Average covered floor area per person in assisted shelters.", kind: "RATIO", unit: "m² per person", agg: "AVERAGE", dir: "H", level: "OUTCOME", freq: "Quarterly", ref: ["GTE", 3.5, "m² per person", "every person; more in cold climates", "Covered living space", false], role: "covered_area", rec: true, std: "Covered living space", mov: ["Shelter survey"] }),
  ind("SH-S-03", "Shelters completed and passing a quality check", { def: "Shelters or repairs completed that passed the agreed quality check.", unit: "shelters", freq: "Monthly", role: "shelters_completed", rec: true, std: "Construction", mov: ["Quality inspection forms"] }),
  ind("SH-S-04", "Households in shelters safe from known hazards", { def: "Share of assisted households whose shelter is not exposed to a known hazard such as flood, landslide or fire.", kind: "RATE", dir: "H", level: "OUTCOME", std: "Shelter and settlement strategy", mov: ["Shelter and site assessment"] }),
  ind("SH-S-05", "Households with secure tenure or an occupancy agreement", { def: "Share of assisted households with a document or agreement that lets them stay for the period they need.", kind: "RATE", dir: "H", level: "OUTCOME", also: ["HLP"], std: "Settlement planning", mov: ["Tenure documents"] }),
  ind("SH-S-06", "Households trained or advised on safe building", { def: "Households or builders who received technical advice or training on building safely.", unit: "households", freq: "Monthly", std: "Technical assistance", mov: ["Training registers"] }),
];
w.group("Settlement planning");
const settlement = [
  ind("SH-P-01", "Sites with water, sanitation, health and school within a reasonable distance", { def: "Share of supported sites where people can reach basic services within a reasonable distance.", kind: "RATE", dir: "H", level: "OUTCOME", std: "Settlement planning", mov: ["Site assessment"], also: ["CCCM"] }),
  ind("SH-P-02", "Sites with fire-safety measures in place", { def: "Share of sites with spacing between structures, firebreaks and escape routes as planned.", kind: "RATE", dir: "H", std: "Settlement planning", mov: ["Site inspection"] }),
];
w.group("Household items");
const items = [
  ind("SH-N-01", "Households receiving household items", { def: "Households that received the planned household-item kit (clothing, bedding, cooking and eating sets, lighting, tools).", unit: "households", freq: "Per distribution", role: "households_nfi", rec: true, std: "Household items", mov: ["Signed distribution lists"] }),
  ind("SH-N-02", "Households with adequate bedding, cooking set and clothing", { def: "Share of surveyed households with enough blankets or mats, a cooking set, and clothing for each member.", kind: "RATE", dir: "H", level: "OUTCOME", std: "Household items", mov: ["Post-distribution monitoring"] }),
  ind("SH-N-03", "Households with a safe and efficient way to cook and heat", { def: "Share of households with a stove and fuel that does not put them at risk or force unsafe collection.", kind: "RATE", dir: "H", level: "OUTCOME", std: "Household items: stoves, fuel and lighting", mov: ["Household survey"] }),
];
w.group("Environment");
const environment = [
  ind("SH-E-01", "Shelter materials from sustainable sources", { def: "Share of timber and other materials that are reused, certified or from sustainable sources.", kind: "RATE", dir: "H", std: "Environmental sustainability", mov: ["Procurement records"], also: ["ENVIRONMENT_ENERGY"] }),
];

export const SHELTER_NFI = defineContent({
  sectorId: "SHELTER_NFI",
  summary: "Safe, adequate shelter, planned settlements and household items, following the Sphere shelter and settlement standards.",
  indicators: [...shelter, ...settlement, ...items, ...environment],
  logframe: [
    { key: "g", level: "GOAL", title: "People have safe, dignified and adequate shelter and a working settlement" },
    { key: "o-shelter", level: "OUTCOME", title: "Households live in shelter that is safe, covered and secure", parent: "g", standards: ["Covered living space", "Construction"] },
    { key: "o-nfi", level: "OUTCOME", title: "Households have the items they need to live in dignity", parent: "g", standards: ["Household items"] },
    { key: "out-shelter", level: "OUTPUT", title: "Shelters built, repaired or supported", parent: "o-shelter" },
    { key: "out-nfi", level: "OUTPUT", title: "Household items distributed", parent: "o-nfi" },
  ],
  assessment: [
    { key: "hh-shelter", question: "How many households need shelter and what is the damage?", answerType: "NUMBER", unit: "households", why: "Sizes the response.", required: true },
    { key: "tenure", question: "What is the tenure situation: own, rent, host, informal, camp?", answerType: "CHOICE", choices: ["Own", "Rent", "Host family", "Informal or unclear", "Camp or collective centre"], why: "Decides materials, cash or repair.", required: true },
    { key: "hazards", question: "What hazards affect the site (flood, landslide, fire, cold)?", answerType: "TEXT", why: "Shapes design and location.", required: true },
    { key: "climate", question: "What is the climate and the usual building materials?", answerType: "TEXT", why: "Sets covered area and design.", required: false },
  ],
  forms: [{ key: "shelter-register", title: "Household shelter register", purpose: "Record a household's shelter, area and condition.", fields: [{ label: "Household", type: "TEXT", required: true }, { label: "Place", type: "PLACE", required: true }, { label: "Household size", type: "NUMBER", required: true }, { label: "Covered area (m²)", type: "NUMBER", required: false }, { label: "Tenure", type: "CHOICE", required: true, choices: ["Own", "Rent", "Host family", "Informal", "Camp"] }], feeds: ["SH-S-02"] }],
  evidence: [
    { key: "damage-assessment", name: "Damage assessment form", description: "Condition of the shelter and household needs.", confidentiality: "INTERNAL" },
    { key: "quality-inspection", name: "Construction quality inspection", description: "Checks of structure and materials at stages of construction.", confidentiality: "INTERNAL" },
    { key: "tenure-document", name: "Tenure or occupancy agreement", description: "A document that shows the right to stay.", confidentiality: "HIGHLY_SENSITIVE" },
  ],
  checklist: [
    { key: "tenure-checked", title: "Tenure and eviction risk were checked for each site", description: "No shelter is built where people can be moved on without notice.", severity: "critical", kind: "ATTESTATION", standard: "Settlement planning" },
    { key: "hazard-screen", title: "Sites were screened for hazards", description: "Flood, landslide, fire and mine risks considered before building.", severity: "high", kind: "ATTESTATION", standard: "Settlement planning" },
  ],
  risks: [
    { title: "Eviction or a tenure dispute", kind: "RISK", seriousness: "HIGH", mitigation: "Agree tenure in writing before building." },
    { title: "Building materials are delayed or cost more", kind: "RISK", seriousness: "MEDIUM", mitigation: "Source locally and agree prices in advance." },
    { title: "Rains or winter arrive before shelters are finished", kind: "RISK", seriousness: "HIGH", mitigation: "Plan the work around the season and provide weatherproofing first." },
  ],
  glossary: [
    { term: "Covered living area", meaning: "The floor area inside the shelter where a household lives and sleeps." },
    { term: "Transitional shelter", meaning: "A shelter that can be upgraded or reused while people work towards a lasting home." },
    { term: "Household items", meaning: "Clothing, bedding, cooking and eating items, lighting, stoves and tools." },
  ],
  blueprint: [
    { title: "Shelter results", guidance: "Households assisted, area per person, quality and hazard safety." },
    { title: "Household items", guidance: "Kits distributed and what households report using." },
    { title: "Tenure and settlement", guidance: "Security of tenure and access to services." },
  ],
  dashboardTemplates: [],
});
