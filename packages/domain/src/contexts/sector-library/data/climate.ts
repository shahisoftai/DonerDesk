import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const cl = sectorWriter({ sector: "CLIMATE_DRR", src: "IFRC" });
cl.group("Resilience and disaster risk reduction");
export const CLIMATE_DRR = defineContent({
  sectorId: "CLIMATE_DRR",
  summary: "Preparing for and adapting to hazards and climate change.",
  indicators: [
    cl.ind("CLI-01", "People covered by early warning", { def: "People who can receive and understand an early warning for the main local hazard.", unit: "people", dims: ["SEX", "AGE", "DIS"], agg: "LATEST", role: "people_early_warning", rec: true, src: "SDG", mov: ["Warning system test", "Household survey"] }),
    cl.ind("CLI-02", "Communities with a disaster risk reduction plan", { def: "Communities with a plan made with residents and reviewed in the last year.", unit: "communities", agg: "LATEST", role: "communities_drr_plan", rec: true, mov: ["Community plans"] }),
    cl.ind("CLI-03", "People trained in preparedness and response", { def: "People who completed preparedness or first response training.", unit: "people", dims: ["SEX"], role: "people_trained_drr", rec: true, mov: ["Training lists"] }),
    cl.ind("CLI-04", "Households adopting a climate-adaptive practice", { def: "Share of supported households using at least one climate-adaptive practice.", kind: "RATE", dir: "H", level: "OUTCOME", role: "households_adapting", mov: ["Household survey"] }),
    cl.ind("CLI-05", "Protective infrastructure built or restored", { def: "Embankments, drains, shelters or other protective works built or restored.", unit: "works", mov: ["Completion certificates"], also: ["INFRASTRUCTURE"] }),
    cl.ind("CLI-06", "Direct economic loss from disasters in the area", { def: "Value of losses from disasters in the project area in the period.", unit: "currency", dir: "L", level: "GOAL", src: "SDG", mov: ["Damage assessments"] }),
    cl.ind("CLI-07", "Households with savings or insurance for shocks", { def: "Share of supported households with savings or insurance that could cover a shock.", kind: "RATE", dir: "H", level: "OUTCOME", mov: ["Household survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Communities are safer and more resilient to hazards and climate change" }, { key: "o-prep", level: "OUTCOME", title: "People are warned and prepared", parent: "g" }, { key: "o-adapt", level: "OUTCOME", title: "Households adapt their livelihoods and assets", parent: "g" }, { key: "out-plan", level: "OUTPUT", title: "Community plans and warning systems in place", parent: "o-prep" }, { key: "out-works", level: "OUTPUT", title: "Protective works and practices delivered", parent: "o-adapt" }],
  assessment: [{ key: "hazards", question: "Which hazards matter most and who is most exposed?", answerType: "TEXT", why: "Sets priorities.", required: true }, { key: "capacity", question: "What local capacity and plans exist?", answerType: "TEXT", why: "Builds on what exists.", required: false }],
  forms: [], evidence: [{ key: "hazard-assessment", name: "Hazard and vulnerability assessment", description: "Risk analysis used for planning.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "A hazard strikes before preparations are complete", kind: "RISK", seriousness: "HIGH", mitigation: "Sequence early warning and evacuation planning first." }],
  glossary: [{ term: "Early warning", meaning: "Information that lets people act before a hazard hits." }],
  blueprint: [{ title: "Preparedness and resilience results", guidance: "Warning coverage, plans and adaptation." }],
  noneBecause: { forms: "Data come from drills and surveys.", checklist: "Covered by the common checklist." },
});

const en = sectorWriter({ sector: "ENVIRONMENT_ENERGY", src: "SDG" });
en.group("Environment and energy");
export const ENVIRONMENT_ENERGY = defineContent({
  sectorId: "ENVIRONMENT_ENERGY",
  summary: "Protecting natural resources and expanding clean, safe energy.",
  indicators: [
    en.ind("ENV-01", "Households with access to clean cooking or lighting", { def: "Households using a clean stove, solar light or other clean energy source.", unit: "households", role: "households_clean_energy", rec: true, mov: ["Household survey", "Distribution lists"] }),
    en.ind("ENV-02", "Renewable energy capacity installed", { def: "Installed capacity of solar or other renewable energy.", unit: "kW", role: "renewable_capacity", rec: true, mov: ["Commissioning reports"] }),
    en.ind("ENV-03", "Area under restoration or protection", { def: "Hectares restored, reforested or protected.", unit: "hectares", role: "area_restored", rec: true, mov: ["Field verification"] }),
    en.ind("ENV-04", "Trees planted and surviving after one year", { def: "Share of trees planted that are alive after twelve months.", kind: "RATE", dir: "H", level: "OUTCOME", role: "tree_survival", mov: ["Follow-up count"] }),
    en.ind("ENV-05", "Households reporting less time or money spent on fuel", { def: "Share of supported households with less fuel time or cost than before.", kind: "RATE", dir: "H", level: "OUTCOME", mov: ["Household survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People use energy safely and natural resources are protected" }, { key: "o-energy", level: "OUTCOME", title: "Households have clean energy", parent: "g" }, { key: "out-install", level: "OUTPUT", title: "Energy systems installed and maintained", parent: "o-energy" }],
  assessment: [{ key: "energy-now", question: "What energy do people use now, at what cost and risk?", answerType: "TEXT", why: "Sets the baseline.", required: true }],
  forms: [], evidence: [{ key: "commissioning", name: "Commissioning report", description: "Proof an installation works.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Equipment is stolen or not maintained", kind: "RISK", seriousness: "MEDIUM", mitigation: "Train local technicians and agree upkeep." }],
  glossary: [{ term: "Clean cooking", meaning: "Cooking with a stove and fuel that causes little smoke." }],
  blueprint: [{ title: "Energy and environment results", guidance: "Clean energy, capacity and restoration." }],
  noneBecause: { forms: "Data come from surveys and commissioning reports.", checklist: "Covered by the common checklist." },
});

const inf = sectorWriter({ sector: "INFRASTRUCTURE", src: "SDG" });
inf.group("Infrastructure");
export const INFRASTRUCTURE = defineContent({
  sectorId: "INFRASTRUCTURE",
  summary: "Roads, bridges, buildings and public works built safely and handed over.",
  indicators: [
    inf.ind("INF-01", "Infrastructure works completed and handed over", { def: "Works completed to specification and formally handed over.", unit: "works", role: "works_completed", rec: true, mov: ["Handover certificates"] }),
    inf.ind("INF-02", "Length of road or path rehabilitated", { def: "Kilometres of road, track or path rehabilitated.", unit: "km", role: "road_rehabilitated", rec: true, mov: ["Engineer's measurements"] }),
    inf.ind("INF-03", "People with improved access to services or markets", { def: "People whose travel time to services or markets fell after the works.", unit: "people", dims: ["SEX", "DIS"], level: "OUTCOME", role: "people_better_access", rec: true, mov: ["Household survey"] }),
    inf.ind("INF-04", "Works passing quality inspection first time", { def: "Share of works that passed their final inspection without rework.", kind: "RATE", dir: "H", role: "works_passing", mov: ["Inspection reports"] }),
    inf.ind("INF-05", "Local workers employed on works", { def: "Workers from the local area employed on works.", unit: "workers", dims: ["SEX"], mov: ["Payroll"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People use safe, lasting infrastructure" }, { key: "o-access", level: "OUTCOME", title: "Better access to services and markets", parent: "g" }, { key: "out-works", level: "OUTPUT", title: "Works completed to standard", parent: "o-access" }],
  assessment: [{ key: "need", question: "Which works are most needed and who benefits?", answerType: "TEXT", why: "Prioritises works.", required: true }],
  forms: [], evidence: [{ key: "inspection", name: "Inspection report", description: "Engineer's checks at stages of construction.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Costs rise or materials are delayed", kind: "RISK", seriousness: "MEDIUM", mitigation: "Hold a contingency and agree prices early." }],
  glossary: [{ term: "Handover", meaning: "The formal transfer of completed works to the owner or community." }],
  blueprint: [{ title: "Infrastructure results", guidance: "Works completed, quality and benefits." }],
  noneBecause: { forms: "Works are tracked in progress reports and inspection forms.", checklist: "Covered by the common checklist." },
});
