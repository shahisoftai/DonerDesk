import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const w = sectorWriter({ sector: "FOOD_SECURITY", src: "SPHERE_2018" });
const { ind } = w;

w.group("Food security assessment");
const assess = [
  ind("FS-A-01", "Households with an acceptable food consumption score", { def: "Share of households whose food consumption score is in the acceptable range, from the foods eaten in the last 7 days.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Quarterly", src: "WFP_CRF", std: "Food consumption score", role: "food_consumption", rec: true, mov: ["Household survey"], tags: ["fcs"] }),
  ind("FS-A-02", "Average household dietary diversity score", { def: "Average number of food groups eaten by the household in the last 24 hours.", kind: "INDEX", unit: "score", agg: "AVERAGE", dir: "H", level: "OUTCOME", freq: "Quarterly", src: "FAO", std: "Household dietary diversity", mov: ["Household survey"] }),
  ind("FS-A-03", "Average reduced coping strategies index", { def: "Average score of how often households use negative coping strategies when they lack food.", kind: "INDEX", unit: "score", agg: "AVERAGE", dir: "L", level: "OUTCOME", freq: "Quarterly", src: "WFP_CRF", std: "Coping strategies index", mov: ["Household survey"] }),
  ind("FS-A-04", "Households with moderate or severe hunger", { def: "Share of households classed with moderate or severe hunger on the Household Hunger Scale.", kind: "RATE", dir: "L", level: "OUTCOME", freq: "Per survey", src: "FAO", std: "Household hunger scale", mov: ["Household survey"] }),
  ind("FS-A-05", "People in crisis or worse food insecurity (IPC phase 3+)", { def: "People classified in IPC phase 3 or above in the area in the latest analysis.", unit: "people", dir: "L", level: "GOAL", freq: "Per analysis", src: "IPC", std: "IPC acute food insecurity", mov: ["IPC analysis report"] }),
];
w.group("Food assistance");
const assistance = [
  ind("FS-D-01", "People receiving food assistance", { def: "People who received in-kind food assistance in the period.", unit: "people", dims: ["SEX", "AGE", "DIS"], freq: "Monthly", role: "people_fed", rec: true, std: "Food assistance", mov: ["Distribution lists", "Beneficiary register"] }),
  ind("FS-D-02", "Food delivered against plan", { def: "Share of the planned quantity of food that was delivered to distribution sites on time.", kind: "RATE", dir: "H", freq: "Monthly", std: "Food assistance", mov: ["Delivery notes", "Distribution reports"] }),
  ind("FS-D-03", "Ration energy value per person per day", { def: "Energy value of the ration planned per person per day, with protein about 10-12% and fat at least 17% of energy.", kind: "RATIO", unit: "kcal/p/d", agg: "AVERAGE", dir: "H", freq: "Per distribution", ref: ["GTE", 2100, "kcal/p/d", "planning figure for a full ration", "Food assistance", false], std: "Food assistance", mov: ["Ration plan"] }),
  ind("FS-D-04", "Food samples meeting quality and safety checks", { def: "Share of food samples checked that met quality and safety standards.", kind: "RATE", dir: "H", freq: "Per distribution", std: "Food quality", mov: ["Quality check records"] }),
  ind("FS-D-05", "Post-distribution monitoring: people who reached the site safely and without paying", { def: "Share of surveyed recipients who reached the distribution site safely and without having to pay anything.", kind: "RATE", dir: "H", freq: "Per distribution", std: "Accountability in food assistance", mov: ["Post-distribution monitoring survey"] }),
];
w.group("Cash and vouchers for food");
const cash = [
  ind("FS-C-01", "People receiving cash or vouchers for food", { def: "People in households that received a cash or voucher transfer for food in the period.", unit: "people", dims: ["SEX", "AGE", "DIS"], freq: "Monthly", role: "people_cash", std: "Food assistance: cash and vouchers", mov: ["Payment lists", "Provider reports"], also: ["CASH"] }),
  ind("FS-C-02", "Transfer value as a share of the minimum expenditure basket", { def: "Value of the transfer divided by the cost of the minimum expenditure basket for the household size.", kind: "RATE", dir: "H", freq: "Monthly", std: "Food assistance: cash and vouchers", mov: ["Market price monitoring", "Payment records"], also: ["CASH"] }),
];
w.group("Livelihoods and production");
const livelihoods = [
  ind("FS-L-01", "Households supported with seeds, tools or livestock inputs", { def: "Households that received agricultural or livestock inputs in the period.", unit: "households", freq: "Per season", role: "households_inputs", rec: true, std: "Livelihoods: primary production", mov: ["Distribution lists"], also: ["AGRICULTURE"] }),
  ind("FS-L-02", "Households reporting increased production or income", { def: "Share of supported households reporting more production or income than at baseline.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Annual", std: "Livelihoods: income and employment", mov: ["Household survey"], also: ["EARLY_RECOVERY"] }),
  ind("FS-L-03", "People in income-generating or employment support", { def: "People who took part in training, grants, cash-for-work or similar income support.", unit: "people", dims: ["SEX", "AGE", "DIS"], freq: "Monthly", std: "Livelihoods: income and employment", mov: ["Participation records"], also: ["EARLY_RECOVERY"] }),
  ind("FS-L-04", "Price of the main staple food compared with baseline", { def: "Price of the main staple in the main market compared with its baseline price, as a ratio.", kind: "RATIO", unit: "ratio to baseline", agg: "LATEST", dir: "L", freq: "Monthly", std: "Livelihoods: access to markets", mov: ["Market monitoring"] }),
];

export const FOOD_SECURITY = defineContent({
  sectorId: "FOOD_SECURITY",
  summary: "Food assistance, cash for food and livelihoods support, following the Sphere food security standards.",
  indicators: [...assess, ...assistance, ...cash, ...livelihoods],
  dashboardTemplates: ["tpl-food-security-livelihoods"],
  logframe: [
    { key: "g", level: "GOAL", title: "People can meet their food needs safely and protect their livelihoods" },
    { key: "o-food", level: "OUTCOME", title: "Households have enough and better food", parent: "g", standards: ["Food assistance"] },
    { key: "o-live", level: "OUTCOME", title: "Households restore or protect their income and production", parent: "g", standards: ["Livelihoods"] },
    { key: "out-dist", level: "OUTPUT", title: "Food, cash or vouchers delivered on time to the right households", parent: "o-food" },
    { key: "out-inputs", level: "OUTPUT", title: "Inputs, training and income support provided", parent: "o-live" },
  ],
  assessment: [
    { key: "fs-level", question: "What is the current food security situation (latest survey or IPC)?", answerType: "TEXT", why: "Sets priority and targeting.", required: true },
    { key: "market", question: "Do markets work well enough for cash or vouchers?", answerType: "CHOICE", choices: ["Yes", "Partly", "No"], why: "Decides in-kind or cash.", required: true },
    { key: "targeting", question: "How will households be chosen, and who checks the list?", answerType: "TEXT", why: "Prevents exclusion and diversion.", required: true },
    { key: "basket", question: "What is the cost of the minimum expenditure basket?", answerType: "NUMBER", why: "Sets the transfer value.", required: false },
  ],
  forms: [{ key: "distribution", title: "Food distribution record", purpose: "Record what was given to how many households at a site.", fields: [{ label: "Site", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Households served", type: "NUMBER", required: true }, { label: "Quantity distributed", type: "NUMBER", required: true }], feeds: ["FS-D-01"] }, { key: "market-price", title: "Market price sheet", purpose: "Record prices of key items in a market.", fields: [{ label: "Market", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Item", type: "TEXT", required: true }, { label: "Price", type: "NUMBER", required: true }], feeds: ["FS-L-04"] }],
  evidence: [
    { key: "distribution-report", name: "Distribution report with signed list", description: "Quantities and the recipients' signatures or thumbprints.", confidentiality: "SENSITIVE" },
    { key: "pdm-report", name: "Post-distribution monitoring report", description: "Recipient survey after a distribution.", confidentiality: "INTERNAL" },
    { key: "market-report", name: "Market monitoring report", description: "Prices and supply in the main markets.", confidentiality: "PUBLIC" },
    { key: "payment-confirmation", name: "Payment confirmation", description: "Provider confirmation that transfers were paid.", confidentiality: "SENSITIVE" },
  ],
  checklist: [
    { key: "targeting-agreed", title: "Targeting criteria were agreed with the community", description: "The criteria and the complaints route were explained and recorded.", severity: "high", kind: "ATTESTATION" },
    { key: "ration-plan", title: "The ration or transfer value is documented", description: "Energy value of the ration or the basket cost behind the transfer.", severity: "medium", kind: "ATTESTATION", standard: "Food assistance" },
  ],
  risks: [
    { title: "Pipeline breaks or delivery is late", kind: "RISK", seriousness: "HIGH", mitigation: "Hold buffer stock and agree alternative routes." },
    { title: "Market prices rise sharply", kind: "RISK", seriousness: "MEDIUM", mitigation: "Monitor prices and adjust the transfer value." },
    { title: "Diversion of food or cash", kind: "RISK", seriousness: "HIGH", mitigation: "Verify recipients, use signed lists and post-distribution checks." },
  ],
  glossary: [
    { term: "Food consumption score", meaning: "A score from how often households ate different food groups in the last 7 days." },
    { term: "Coping strategies", meaning: "Things households do when food runs short, such as eating less or selling assets." },
    { term: "IPC phase", meaning: "A five-level scale of how severe a food crisis is in an area." },
  ],
  blueprint: [
    { title: "Food security situation", guidance: "Consumption, hunger and coping results." },
    { title: "Assistance delivered", guidance: "People reached, quantities and quality." },
    { title: "Livelihoods results", guidance: "Inputs, income and production." },
  ],
});
