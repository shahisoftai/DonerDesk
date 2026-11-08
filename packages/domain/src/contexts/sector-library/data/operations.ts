import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const cc = sectorWriter({ sector: "CCCM", src: "CCCM_CLUSTER" });
cc.group("Site management and participation");
export const CCCM = defineContent({
  sectorId: "CCCM",
  summary: "Managing camps and collective sites so people can live safely and take part in decisions.",
  indicators: [
    cc.ind("CCCM-01", "Sites with a site management structure in place", { def: "Sites with an agreed management team and a regular coordination meeting.", unit: "sites", role: "sites_managed", rec: true, mov: ["Site profiles", "Meeting minutes"] }),
    cc.ind("CCCM-02", "People living in managed sites", { def: "People registered in sites with a site management structure.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_in_sites", rec: true, agg: "LATEST", mov: ["Site registration"] }),
    cc.ind("CCCM-03", "Sites with a community committee that includes women and people with disabilities", { def: "Share of sites with a representative committee.", kind: "RATE", dir: "H", level: "OUTCOME", role: "sites_with_committee", mov: ["Committee lists"] }),
    cc.ind("CCCM-04", "Sites with a working feedback and complaints mechanism", { def: "Share of sites where residents can give feedback and receive an answer.", kind: "RATE", dir: "H", mov: ["Mechanism audit"], also: ["PROTECTION_AAP"] }),
    cc.ind("CCCM-05", "Sites with multi-sector service gaps reported and followed up", { def: "Number of sites where gaps in water, shelter, health or protection were reported to the right cluster and followed up.", unit: "sites", mov: ["Gap reports"] }),
    cc.ind("CCCM-06", "Site residents who feel safe and informed", { def: "Share of surveyed residents who report feeling safe and know where to get help.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE"], mov: ["Resident survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People in camps and collective sites live safely and with dignity" }, { key: "o-man", level: "OUTCOME", title: "Sites are well managed with residents taking part", parent: "g" }, { key: "out-struct", level: "OUTPUT", title: "Site structures and committees established", parent: "o-man" }],
  assessment: [{ key: "sites", question: "How many sites are there, how many people live in each, and who runs them?", answerType: "NUMBER", why: "Sizes management needs.", required: true }],
  forms: [], evidence: [{ key: "site-profile", name: "Site profile", description: "Population, services and risks of a site.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Sites close or residents are moved without notice", kind: "RISK", seriousness: "HIGH", mitigation: "Agree notice and alternatives with authorities and residents." }],
  glossary: [{ term: "Collective centre", meaning: "A building such as a school or hall used to shelter displaced people." }],
  blueprint: [{ title: "Site management results", guidance: "Sites managed, participation and feedback." }],
  noneBecause: { forms: "Site data are kept in site profiles and registration systems.", checklist: "Covered by the common checklist." },
});

const lg = sectorWriter({ sector: "LOGISTICS", src: "CLUSTER_REGISTRY" });
lg.group("Humanitarian logistics");
export const LOGISTICS = defineContent({
  sectorId: "LOGISTICS",
  summary: "Moving and storing relief items so partners can respond.",
  indicators: [
    lg.ind("LOG-01", "Cargo transported for partners", { def: "Tonnes of relief cargo moved on behalf of partners.", unit: "tonnes", role: "cargo_moved", rec: true, mov: ["Waybills"] }),
    lg.ind("LOG-02", "Organisations served", { def: "Organisations that used logistics services in the period.", unit: "organisations", role: "orgs_served", rec: true, mov: ["Service request log"] }),
    lg.ind("LOG-03", "Storage space provided", { def: "Cubic metres of storage space available to partners.", unit: "m³", agg: "LATEST", role: "storage_space", mov: ["Warehouse records"] }),
    lg.ind("LOG-04", "Requests fulfilled on time", { def: "Share of service requests delivered within the agreed time.", kind: "RATE", dir: "H", level: "OUTCOME", role: "requests_on_time", rec: true, mov: ["Request log"] }),
    lg.ind("LOG-05", "Loss and damage rate", { def: "Share of cargo lost or damaged in transit or storage.", kind: "RATE", dir: "L", mov: ["Loss reports"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Relief reaches people on time" }, { key: "o-serv", level: "OUTCOME", title: "Partners can move and store relief items", parent: "g" }, { key: "out-move", level: "OUTPUT", title: "Cargo moved and stored", parent: "o-serv" }],
  assessment: [{ key: "access", question: "What are the main transport and storage constraints?", answerType: "TEXT", why: "Shapes routes and capacity.", required: true }],
  forms: [], evidence: [{ key: "waybill", name: "Waybill and delivery note", description: "Proof of cargo moved.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Roads are cut or cargo is blocked", kind: "RISK", seriousness: "HIGH", mitigation: "Plan alternative routes and keep buffer stock." }],
  glossary: [{ term: "Waybill", meaning: "A document listing cargo carried from one place to another." }],
  blueprint: [{ title: "Logistics services", guidance: "Cargo moved, storage provided and requests met." }],
  noneBecause: { forms: "Logistics data come from waybills and warehouse systems.", checklist: "Covered by the common checklist." },
});

const tc = sectorWriter({ sector: "TELECOMS", src: "CLUSTER_REGISTRY" });
tc.group("Emergency telecommunications");
export const TELECOMS = defineContent({
  sectorId: "TELECOMS",
  summary: "Shared communications and data connectivity for responders.",
  indicators: [
    tc.ind("ETC-01", "Humanitarian sites with data connectivity", { def: "Sites where responders can reach a working internet connection.", unit: "sites", agg: "LATEST", role: "sites_connected", rec: true, mov: ["Service reports"] }),
    tc.ind("ETC-02", "Organisations using shared communications services", { def: "Organisations using shared radio or data services.", unit: "organisations", role: "orgs_comms", rec: true, mov: ["Service registry"] }),
    tc.ind("ETC-03", "Service availability", { def: "Share of time shared services were available.", kind: "RATE", dir: "H", level: "OUTCOME", role: "service_uptime", rec: true, mov: ["Monitoring logs"] }),
    tc.ind("ETC-04", "Responders trained in radio and security communications", { def: "Staff trained to use shared communications.", unit: "people", dims: ["SEX"], role: "responders_trained_comms", mov: ["Training lists"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Responders can communicate safely and reliably" }, { key: "o-comm", level: "OUTCOME", title: "Shared communications services are available", parent: "g" }, { key: "out-set", level: "OUTPUT", title: "Services installed and maintained", parent: "o-comm" }],
  assessment: [{ key: "gaps", question: "Where are the communications gaps in the response area?", answerType: "TEXT", why: "Targets installation.", required: true }],
  forms: [], evidence: [{ key: "uptime-log", name: "Uptime log", description: "Service availability over time.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Equipment fails or is lost", kind: "RISK", seriousness: "MEDIUM", mitigation: "Keep spares and monitor service health." }],
  glossary: [{ term: "Uptime", meaning: "The share of time a service works." }],
  blueprint: [{ title: "Connectivity and services", guidance: "Sites connected and service availability." }],
  noneBecause: { forms: "Data come from monitoring systems.", checklist: "Covered by the common checklist." },
});

const co = sectorWriter({ sector: "COORDINATION", src: "OCHA_HRP" });
co.group("Coordination and information management");
export const COORDINATION = defineContent({
  sectorId: "COORDINATION",
  summary: "Coordinating partners and sharing information so aid is not duplicated or missed.",
  indicators: [
    co.ind("COO-01", "Coordination meetings held", { def: "Coordination meetings held with minutes shared.", unit: "meetings", role: "meetings_held", rec: true, mov: ["Minutes"] }),
    co.ind("COO-02", "Partners reporting to the response (3W)", { def: "Organisations that reported who is doing what where.", unit: "organisations", role: "partners_reporting", rec: true, mov: ["3W database"] }),
    co.ind("COO-03", "Information products published", { def: "Maps, dashboards, snapshots or bulletins published.", unit: "products", role: "products_published", rec: true, mov: ["Publication log"] }),
    co.ind("COO-04", "Assessments coordinated or shared", { def: "Joint or shared assessments in the period.", unit: "assessments", mov: ["Assessment registry"] }),
    co.ind("COO-05", "Partners who say coordination helped them avoid duplication", { def: "Share of surveyed partners who report that coordination improved their targeting.", kind: "RATE", dir: "H", level: "OUTCOME", role: "coordination_useful", mov: ["Partner survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Aid is coordinated and complementary" }, { key: "o-coord", level: "OUTCOME", title: "Partners plan and act together using shared information", parent: "g" }, { key: "out-3w", level: "OUTPUT", title: "Who-does-what-where information kept current", parent: "o-coord" }],
  assessment: [{ key: "partners", question: "Who are the actors and what coordination exists already?", answerType: "TEXT", why: "Avoids duplication.", required: true }],
  forms: [], evidence: [{ key: "3w", name: "3W matrix", description: "Who does what where, by sector.", confidentiality: "PUBLIC" }],
  checklist: [], risks: [{ title: "Partners do not share data", kind: "RISK", seriousness: "MEDIUM", mitigation: "Agree a data-sharing protocol and show the value." }],
  glossary: [{ term: "3W", meaning: "A table of who is doing what, where." }],
  blueprint: [{ title: "Coordination results", guidance: "Meetings, reporting partners and products." }],
  noneBecause: { forms: "Data come from the 3W database.", checklist: "Covered by the common checklist." },
});
