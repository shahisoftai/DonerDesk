import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const ed = sectorWriter({ sector: "ECONOMIC_DEVELOPMENT", src: "DONOR_FRAMEWORKS" });
ed.group("Jobs, enterprise and finance");
export const ECONOMIC_DEVELOPMENT = defineContent({
  sectorId: "ECONOMIC_DEVELOPMENT",
  summary: "Jobs, enterprise growth and access to finance and markets.",
  indicators: [
    ed.ind("ECO-01", "Jobs created or sustained", { def: "Full-time equivalent jobs created or kept with project support.", unit: "jobs", dims: ["SEX", "AGE", "DIS"], role: "jobs_created", rec: true, mov: ["Employer records", "Follow-up survey"] }),
    ed.ind("ECO-02", "Enterprises receiving business development support", { def: "Micro and small enterprises that received training, mentoring or grants.", unit: "enterprises", dims: ["SEX"], role: "enterprises_supported", rec: true, mov: ["Support records"] }),
    ed.ind("ECO-03", "Supported enterprises reporting increased sales", { def: "Share of supported enterprises with higher sales than at baseline.", kind: "RATE", dir: "H", level: "OUTCOME", role: "enterprises_sales_up", mov: ["Business survey"] }),
    ed.ind("ECO-04", "People accessing a formal financial service", { def: "People who opened or used a savings, credit or insurance product through the project.", unit: "people", dims: ["SEX", "AGE"], role: "people_finance", rec: true, mov: ["Provider records"] }),
    ed.ind("ECO-05", "Value of loans disbursed", { def: "Total value of loans disbursed to project clients.", unit: "currency", mov: ["Loan portfolio report"] }),
    ed.ind("ECO-06", "Loan repayment rate", { def: "Share of loans repaid on time.", kind: "RATE", dir: "H", mov: ["Loan portfolio report"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Households and enterprises prosper through decent work and access to markets" }, { key: "o-jobs", level: "OUTCOME", title: "More decent jobs and stronger enterprises", parent: "g" }, { key: "out-supp", level: "OUTPUT", title: "Enterprises supported and finance extended", parent: "o-jobs" }],
  assessment: [{ key: "sectors", question: "Which value chains or sectors have the most potential for jobs?", answerType: "TEXT", why: "Targets support.", required: true }],
  forms: [], evidence: [{ key: "business-survey", name: "Business survey", description: "Sales, employment and finance data from supported enterprises.", confidentiality: "SENSITIVE" }],
  checklist: [], risks: [{ title: "Demand collapses or competitors undercut supported businesses", kind: "RISK", seriousness: "MEDIUM", mitigation: "Test demand and diversify products and buyers." }],
  glossary: [{ term: "Full-time equivalent", meaning: "Hours worked converted to full-time jobs so part-time work can be added." }],
  blueprint: [{ title: "Enterprise and jobs results", guidance: "Jobs, sales and finance." }],
  noneBecause: { forms: "Enterprise data come from periodic surveys.", checklist: "Covered by the common checklist." },
});

const sp = sectorWriter({ sector: "SOCIAL_PROTECTION", src: "SDG" });
sp.group("Social protection coverage");
export const SOCIAL_PROTECTION = defineContent({
  sectorId: "SOCIAL_PROTECTION",
  summary: "Regular, predictable support through social safety nets and the systems that deliver them.",
  indicators: [
    sp.ind("SP-01", "People covered by social protection supported by the project", { def: "People in households receiving a regular social transfer or insurance the project supports.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_social_protection", rec: true, mov: ["Programme registry"] }),
    sp.ind("SP-02", "Households enrolled in the social registry", { def: "Households recorded in the registry used for targeting.", unit: "households", role: "households_registered", rec: true, mov: ["Registry extract"] }),
    sp.ind("SP-03", "Payments made on schedule", { def: "Share of scheduled payments made on the due date.", kind: "RATE", dir: "H", role: "payments_on_time", mov: ["Payment records"] }),
    sp.ind("SP-04", "Eligible households receiving the transfer (inclusion)", { def: "Share of eligible households who are enrolled and receive the transfer.", kind: "RATE", dir: "H", level: "OUTCOME", role: "inclusion", mov: ["Registry and payroll"] }),
    sp.ind("SP-05", "Staff trained in delivery systems", { def: "Government or partner staff trained in registration, payment or grievance systems.", unit: "people", dims: ["SEX"], mov: ["Training lists"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Vulnerable households are protected from shocks and poverty" }, { key: "o-cov", level: "OUTCOME", title: "More eligible households receive regular support", parent: "g" }, { key: "out-sys", level: "OUTPUT", title: "Delivery systems strengthened", parent: "o-cov" }],
  assessment: [{ key: "scheme", question: "Which scheme is supported and who runs it?", answerType: "TEXT", why: "Sets the role of the project.", required: true }],
  forms: [], evidence: [{ key: "registry-extract", name: "Registry extract", description: "Enrolment counts without personal details.", confidentiality: "SENSITIVE" }],
  checklist: [], risks: [{ title: "Exclusion errors leave eligible households out", kind: "RISK", seriousness: "HIGH", mitigation: "Use grievance and re-registration windows." }],
  glossary: [{ term: "Social registry", meaning: "A database of households used to decide who can receive support." }],
  blueprint: [{ title: "Coverage and delivery", guidance: "People covered and payments on time." }],
  noneBecause: { forms: "Data come from the programme registry.", checklist: "Covered by the common checklist." },
});

const gv = sectorWriter({ sector: "GOVERNANCE", src: "DONOR_FRAMEWORKS" });
gv.group("Governance and civil society");
export const GOVERNANCE = defineContent({
  sectorId: "GOVERNANCE",
  summary: "Accountable institutions, participation and a strong civil society.",
  indicators: [
    gv.ind("GOV-01", "Civil society organisations strengthened", { def: "Organisations that completed capacity support and improved on an agreed assessment.", unit: "organisations", role: "cso_strengthened", rec: true, mov: ["Capacity assessments"] }),
    gv.ind("GOV-02", "Citizens taking part in consultation or planning", { def: "People who took part in public consultations, budget meetings or planning forums.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "citizens_participating", rec: true, mov: ["Meeting attendance lists"] }),
    gv.ind("GOV-03", "Public services improved after citizen feedback", { def: "Services where a change was made in response to citizen feedback or monitoring.", unit: "services", role: "services_improved", mov: ["Documented changes"] }),
    gv.ind("GOV-04", "Local authority budgets published and consulted", { def: "Authorities that published their budget and held a public consultation.", unit: "authorities", role: "budgets_published", mov: ["Published budgets"], src: "SDG" }),
    gv.ind("GOV-05", "Women in decision-making bodies supported", { def: "Women holding seats on committees or councils supported by the project.", unit: "women", mov: ["Membership lists"], also: ["GENDER_EQUALITY"] }),
    gv.ind("GOV-06", "Citizens who say local government listens to them", { def: "Share of surveyed citizens who say authorities consider their views.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], freq: "Annual", mov: ["Perception survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Institutions are accountable and people take part in decisions" }, { key: "o-acc", level: "OUTCOME", title: "Citizens influence local decisions", parent: "g" }, { key: "out-cso", level: "OUTPUT", title: "Civil society groups strengthened", parent: "o-acc" }],
  assessment: [{ key: "stakeholders", question: "Who are the key actors and what are the main barriers to participation?", answerType: "TEXT", why: "Targets support.", required: true }],
  forms: [], evidence: [{ key: "perception-survey", name: "Perception survey", description: "Citizens' views on governance.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Civil society space shrinks", kind: "RISK", seriousness: "HIGH", mitigation: "Stay politically neutral, protect partners and diversify allies." }],
  glossary: [{ term: "Civil society organisation", meaning: "A non-governmental group acting in the public interest." }],
  blueprint: [{ title: "Participation and accountability", guidance: "Reach, changes made and citizen views." }],
  noneBecause: { forms: "Governance data come from meeting records and surveys.", checklist: "Covered by the common checklist." },
});

const pb = sectorWriter({ sector: "PEACEBUILDING", src: "DONOR_FRAMEWORKS" });
pb.group("Peace and social cohesion");
export const PEACEBUILDING = defineContent({
  sectorId: "PEACEBUILDING",
  summary: "Reducing conflict and strengthening trust between groups.",
  indicators: [
    pb.ind("PB-01", "People taking part in dialogue or mediation", { def: "People who took part in structured dialogue, mediation or joint activities across divides.", unit: "people", dims: ["SEX", "AGE"], role: "dialogue_participants", rec: true, mov: ["Attendance lists"] }),
    pb.ind("PB-02", "Local disputes resolved peacefully", { def: "Disputes that reached an agreed resolution through local mechanisms.", unit: "disputes", role: "disputes_resolved", rec: true, mov: ["Mediation records"] }),
    pb.ind("PB-03", "People who report trusting members of another group", { def: "Share of surveyed people who say they trust people from another group.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE"], freq: "Per survey", role: "cross_group_trust", rec: true, mov: ["Perception survey"] }),
    pb.ind("PB-04", "Violent incidents in the target area", { def: "Violent incidents recorded in the target area in the period.", unit: "incidents", dir: "L", level: "GOAL", dims: ["LOC"], mov: ["Incident monitoring"] }),
    pb.ind("PB-05", "Youth and women in peace structures", { def: "Young people and women serving in local peace committees.", unit: "people", dims: ["SEX", "AGE"], mov: ["Membership lists"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Communities live together peacefully" }, { key: "o-trust", level: "OUTCOME", title: "Trust between groups increases", parent: "g" }, { key: "out-dial", level: "OUTPUT", title: "Dialogue and mediation held", parent: "o-trust" }],
  assessment: [{ key: "conflict", question: "What is the conflict analysis: causes, actors, and who is affected?", answerType: "TEXT", why: "Prevents doing harm.", required: true }],
  forms: [], evidence: [{ key: "conflict-analysis", name: "Conflict analysis", description: "The analysis the programme follows.", confidentiality: "SENSITIVE" }],
  checklist: [{ key: "conflict-sensitive", title: "The project was checked for conflict sensitivity", description: "Assistance does not feed tension between groups.", severity: "high", kind: "ATTESTATION" }],
  risks: [{ title: "Activities increase tension", kind: "RISK", seriousness: "HIGH", mitigation: "Review conflict sensitivity regularly and adapt." }],
  glossary: [{ term: "Social cohesion", meaning: "The strength of relationships and trust between people and groups." }],
  blueprint: [{ title: "Peace and cohesion results", guidance: "Dialogue, disputes resolved and trust." }],
  noneBecause: { forms: "Peacebuilding data come from sessions and surveys." },
});
