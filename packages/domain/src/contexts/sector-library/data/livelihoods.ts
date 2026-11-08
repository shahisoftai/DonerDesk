import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const er = sectorWriter({ sector: "EARLY_RECOVERY", src: "MERS" });
er.group("Livelihoods and economic recovery");
export const EARLY_RECOVERY = defineContent({
  sectorId: "EARLY_RECOVERY",
  summary: "Restoring livelihoods, income and basic services after crisis.",
  indicators: [
    er.ind("ER-01", "People supported with income opportunities", { def: "People who took part in cash-for-work, enterprise grants, training or placement.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_income_support", rec: true, mov: ["Participation records"] }),
    er.ind("ER-02", "Households reporting regular income above baseline", { def: "Share of supported households whose income is above its baseline level.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Annual", role: "households_income_up", rec: true, mov: ["Household survey"] }),
    er.ind("ER-03", "Cash-for-work days created", { def: "Paid workdays created through public-works or cash-for-work activities.", unit: "workdays", dims: ["SEX"], role: "workdays_created", rec: true, mov: ["Attendance and payment sheets"] }),
    er.ind("ER-04", "Community assets rehabilitated", { def: "Roads, canals, markets or similar assets rehabilitated through the project.", unit: "assets", role: "assets_rehabilitated", mov: ["Completion certificates"], also: ["INFRASTRUCTURE"] }),
    er.ind("ER-05", "Businesses restarted or established", { def: "Small businesses that restarted or started with project support and were trading after 3 months.", unit: "businesses", dims: ["SEX"], mov: ["Business follow-up visits"], src: "MERS" }),
    er.ind("ER-06", "People who completed vocational or business skills training", { def: "People who completed the full training course.", unit: "people", dims: ["SEX", "AGE", "DIS"], mov: ["Course completion lists"] }),
    er.ind("ER-07", "Trainees in work or self-employed after 6 months", { def: "Share of trainees who are working or self-employed six months after training.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], mov: ["Follow-up survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Households restore a safe, regular income" }, { key: "o-income", level: "OUTCOME", title: "People earn income from work or enterprise", parent: "g" }, { key: "out-skills", level: "OUTPUT", title: "People trained and placed", parent: "o-income" }, { key: "out-works", level: "OUTPUT", title: "Cash-for-work and enterprise support delivered", parent: "o-income" }],
  assessment: [{ key: "markets", question: "Which markets and jobs are available, and who has access?", answerType: "TEXT", why: "Livelihood support must fit demand.", required: true }, { key: "skills", question: "What skills and assets do people have?", answerType: "TEXT", why: "Matches support to people.", required: false }],
  forms: [{ key: "cfw-attendance", title: "Cash-for-work attendance", purpose: "Record days worked.", fields: [{ label: "Site", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Women working", type: "NUMBER", required: true }, { label: "Men working", type: "NUMBER", required: true }], feeds: ["ER-03"] }],
  evidence: [{ key: "market-assessment", name: "Market and livelihood assessment", description: "Demand, supply and opportunities.", confidentiality: "INTERNAL" }],
  checklist: [{ key: "no-child-labour", title: "Work activities do not involve child labour and are safe", description: "Minimum age and safety checks.", severity: "high", kind: "ATTESTATION" }],
  risks: [{ title: "Market demand is weaker than expected", kind: "RISK", seriousness: "MEDIUM", mitigation: "Test the market before training and adjust trades." }],
  glossary: [{ term: "Cash-for-work", meaning: "Pay for work on community projects, giving income and building assets." }],
  blueprint: [{ title: "Livelihood results", guidance: "Income, jobs and enterprise outcomes." }],
});

const ca = sectorWriter({ sector: "CASH", src: "CALP" });
ca.group("Cash and voucher assistance");
export const CASH = defineContent({
  sectorId: "CASH",
  summary: "Cash and voucher transfers that let people meet their needs, and the checks that keep them safe and fair.",
  indicators: [
    ca.ind("CASH-01", "People receiving cash or vouchers", { def: "People in households that received a transfer in the period.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_cash_total", rec: true, mov: ["Payment lists", "Provider reports"] }),
    ca.ind("CASH-02", "Households receiving cash or vouchers", { def: "Households that received a transfer in the period.", unit: "households", role: "households_cash", rec: true, mov: ["Payment lists"] }),
    ca.ind("CASH-03", "Total value transferred", { def: "Total value of cash or vouchers paid out.", kind: "COUNT", unit: "currency", role: "value_transferred", rec: true, mov: ["Provider reconciliation"] }),
    ca.ind("CASH-04", "Payments reaching the intended person on time", { def: "Share of payments received by the intended recipient within the planned number of days.", kind: "RATE", dir: "H", mov: ["Post-distribution monitoring"] }),
    ca.ind("CASH-05", "Transfer value as a share of the minimum expenditure basket", { def: "Transfer value divided by the cost of the minimum expenditure basket for the household size.", kind: "RATE", dir: "H", mov: ["Market monitoring"], also: ["FOOD_SECURITY"] }),
    ca.ind("CASH-06", "Recipients who report they could spend the cash on their priority needs", { def: "Share of surveyed recipients who say the transfer covered the needs they chose.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], freq: "Per survey", mov: ["Post-distribution monitoring"] }),
    ca.ind("CASH-07", "Recipients reporting safety or access problems", { def: "Share of surveyed recipients who reported a problem with safety, access or fees collecting the transfer.", kind: "RATE", dir: "L", dims: ["SEX", "DIS"], mov: ["Post-distribution monitoring"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Households can meet their basic needs with dignity and choice" }, { key: "o-needs", level: "OUTCOME", title: "Households spend transfers on their priority needs", parent: "g" }, { key: "out-pay", level: "OUTPUT", title: "Transfers delivered safely, on time and in full", parent: "o-needs" }],
  assessment: [{ key: "feasibility", question: "Are markets, providers and risks suitable for cash or vouchers?", answerType: "TEXT", why: "Cash is chosen only when it works.", required: true }, { key: "mechanism", question: "Which delivery mechanism will be used and why?", answerType: "CHOICE", choices: ["Mobile money", "Bank or agent", "Prepaid card", "Cash in hand", "Vouchers"], why: "Affects safety, cost and access.", required: true }],
  forms: [{ key: "payment-batch", title: "Payment reconciliation", purpose: "Record a payment batch against the plan.", fields: [{ label: "Batch", type: "TEXT", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Households paid", type: "NUMBER", required: true }, { label: "Amount paid", type: "NUMBER", required: true }], feeds: ["CASH-02", "CASH-03"] }],
  evidence: [{ key: "payment-reconciliation", name: "Provider reconciliation", description: "Payments made, failed and reversed.", confidentiality: "SENSITIVE" }, { key: "cash-pdm", name: "Post-distribution monitoring report", description: "Recipient survey about the transfer.", confidentiality: "INTERNAL" }],
  checklist: [{ key: "cash-data-protection", title: "A data-sharing agreement covers recipient data given to the provider", description: "Minimal data, purpose and retention are stated.", severity: "high", kind: "ATTESTATION" }],
  risks: [{ title: "Diversion or fraud", kind: "RISK", seriousness: "HIGH", mitigation: "Verify recipients, reconcile with the provider and monitor after payment." }, { title: "Inflation reduces the value of transfers", kind: "RISK", seriousness: "MEDIUM", mitigation: "Review the basket and adjust the value." }],
  glossary: [{ term: "Minimum expenditure basket", meaning: "The cost of the items a household needs every month, used to set the transfer value." }, { term: "Multi-purpose cash", meaning: "A cash transfer a household can spend on any need." }],
  blueprint: [{ title: "Cash assistance delivered", guidance: "People and value paid." }, { title: "Cash outcomes", guidance: "What recipients spent on and their safety." }],
});

const ag = sectorWriter({ sector: "AGRICULTURE", src: "FAO" });
ag.group("Crops, livestock and markets");
export const AGRICULTURE = defineContent({
  sectorId: "AGRICULTURE",
  summary: "Improving crop and livestock production, markets and resilience for farming and herding households.",
  indicators: [
    ag.ind("AGR-01", "Farmers trained in improved practices", { def: "Farmers who completed training in improved crop, livestock or storage practices.", unit: "farmers", dims: ["SEX", "AGE"], role: "farmers_trained", rec: true, mov: ["Training attendance lists"] }),
    ag.ind("AGR-02", "Farmers adopting at least one improved practice", { def: "Share of trained farmers using an improved practice at follow-up.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], role: "practice_adoption", rec: true, mov: ["Follow-up survey"] }),
    ag.ind("AGR-03", "Households receiving seeds, tools or other inputs", { def: "Households that received agricultural inputs.", unit: "households", role: "households_inputs_ag", rec: true, mov: ["Distribution lists"] }),
    ag.ind("AGR-04", "Average yield of the main crop", { def: "Average kilograms harvested per hectare of the main crop in supported households.", kind: "RATIO", unit: "kg/ha", agg: "AVERAGE", dir: "H", level: "OUTCOME", freq: "Per season", role: "crop_yield", mov: ["Harvest survey"] }),
    ag.ind("AGR-05", "Livestock vaccinated or treated", { def: "Animals vaccinated or treated by species.", unit: "animals", mov: ["Vaccination records"], src: "LEGS" }),
    ag.ind("AGR-06", "Area under improved or protected production", { def: "Hectares under irrigation, conservation or other improved production.", unit: "hectares", mov: ["Field verification"] }),
    ag.ind("AGR-07", "Farmer groups selling together or to a market", { def: "Farmer groups that sold produce collectively or to a formal buyer in the period.", unit: "groups", mov: ["Group sales records"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Farming and herding households have more productive, resilient livelihoods" }, { key: "o-prod", level: "OUTCOME", title: "Households produce more and sell more", parent: "g" }, { key: "out-inputs", level: "OUTPUT", title: "Inputs and services provided", parent: "o-prod" }, { key: "out-train", level: "OUTPUT", title: "Farmers trained", parent: "o-prod" }],
  assessment: [{ key: "farming", question: "What are the main crops, livestock and constraints?", answerType: "TEXT", why: "Shapes support.", required: true }, { key: "season", question: "When are the planting and harvest seasons?", answerType: "TEXT", why: "Timing is critical for inputs.", required: true }],
  forms: [], evidence: [{ key: "harvest-survey", name: "Harvest survey", description: "Production and yield data.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Drought, flood or pests damage crops", kind: "RISK", seriousness: "HIGH", mitigation: "Use adapted varieties, early warning and insurance where possible." }],
  glossary: [{ term: "Yield", meaning: "How much is harvested from each hectare." }],
  blueprint: [{ title: "Production results", guidance: "Practices adopted, yield and sales." }],
  noneBecause: { forms: "Agriculture data come from seasonal surveys and registers recorded in the sector's standard forms.", checklist: "Covered by the common checklist." },
});
