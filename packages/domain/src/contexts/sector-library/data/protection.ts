import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const pr = sectorWriter({ sector: "PROTECTION", src: "UNHCR_RBM" });
pr.group("Protection monitoring and services");
export const PROTECTION = defineContent({
  sectorId: "PROTECTION",
  summary: "Protecting people from violence, coercion and deprivation and helping them claim their rights.",
  indicators: [
    pr.ind("PRO-01", "People reached with protection services", { def: "People who received at least one protection service (case management, legal aid, referral, community-based protection).", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_protection_services", rec: true, mov: ["Service registers (confidential)"] }),
    pr.ind("PRO-02", "Protection incidents recorded through monitoring", { def: "Incidents recorded by protection monitors in the period (counts only, never personal details).", unit: "incidents", dims: ["SEX", "AGE", "LOC"], dir: "N", role: "protection_incidents", freq: "Monthly", mov: ["Protection monitoring database"] }),
    pr.ind("PRO-03", "Cases referred to the right service within agreed time", { def: "Share of identified cases referred to a specialist service within the time the referral pathway sets.", kind: "RATE", dir: "H", level: "OUTCOME", role: "referrals_on_time", rec: true, mov: ["Referral tracker"] }),
    pr.ind("PRO-04", "People receiving legal counselling or documentation support", { def: "People who received legal advice, help with civil documentation or legal representation.", unit: "people", dims: ["SEX", "AGE"], role: "legal_support", mov: ["Legal aid register"], src: "UNHCR_RBM" }),
    pr.ind("PRO-05", "Community-based protection structures active", { def: "Community committees or networks that met in the period and acted on protection concerns.", unit: "structures", freq: "Quarterly", mov: ["Meeting minutes"] }),
    pr.ind("PRO-06", "People who feel safe in their daily activities", { def: "Share of surveyed people who say they feel safe where they live and move.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE", "DIS"], freq: "Per survey", mov: ["Perception survey"] }),
    pr.ind("PRO-07", "Staff trained in protection principles and referral", { def: "Staff and volunteers who completed training in protection principles, safe referral and confidentiality.", unit: "people", dims: ["SEX"], mov: ["Training lists"], src: "CHS_2014" }),
  ],
  dashboardTemplates: ["tpl-protection-services"],
  logframe: [
    { key: "g", level: "GOAL", title: "People are safer and able to claim their rights" },
    { key: "o-serv", level: "OUTCOME", title: "People at risk receive timely protection services", parent: "g" },
    { key: "out-case", level: "OUTPUT", title: "Cases identified, assessed and referred", parent: "o-serv" },
    { key: "out-comm", level: "OUTPUT", title: "Communities act to protect their members", parent: "o-serv" },
  ],
  assessment: [
    { key: "risks", question: "What are the main protection risks and who faces them?", answerType: "TEXT", why: "Shapes services and targeting.", required: true },
    { key: "pathway", question: "Is there an agreed referral pathway and who are the service providers?", answerType: "TEXT", why: "Cases need somewhere to go.", required: true },
    { key: "consent", question: "How is informed consent obtained and recorded?", answerType: "TEXT", why: "Consent protects the person and the team.", required: true },
  ],
  forms: [{ key: "referral", title: "Referral slip", purpose: "Record that a case was referred, without personal details in this form.", fields: [{ label: "Date", type: "DATE", required: true }, { label: "Service referred to", type: "TEXT", required: true }, { label: "Consent given", type: "YES_NO", required: true }, { label: "Urgent", type: "YES_NO", required: true }], feeds: ["PRO-03"] }],
  evidence: [{ key: "protection-assessment", name: "Protection assessment", description: "Analysis of risks and capacities.", confidentiality: "SENSITIVE" }, { key: "case-records", name: "Case records", description: "Individual case files.", confidentiality: "HIGHLY_SENSITIVE" }],
  checklist: [{ key: "confidential-store", title: "Case files are stored securely and shared only with consent", description: "Locked storage, restricted access, minimal data.", severity: "critical", kind: "ATTESTATION", standard: "Protection Principle 1" }],
  risks: [{ title: "Information about people is leaked", kind: "RISK", seriousness: "HIGH", mitigation: "Minimise data, restrict access and train staff." }, { title: "Referral services do not exist or are overloaded", kind: "RISK", seriousness: "HIGH", mitigation: "Map services early and agree capacity." }],
  glossary: [{ term: "Protection", meaning: "Activities that keep people safe from violence, coercion and deprivation and help them claim their rights." }, { term: "Referral pathway", meaning: "The agreed route a person follows to reach specialist help, and who is responsible at each step." }],
  blueprint: [{ title: "Protection risks and trends", guidance: "What monitoring shows, in counts and patterns only." }, { title: "Services provided", guidance: "People reached and referrals completed." }],
});

const cp = sectorWriter({ sector: "CHILD_PROTECTION", src: "CPMS_2019" });
cp.group("Child protection services");
export const CHILD_PROTECTION = defineContent({
  sectorId: "CHILD_PROTECTION",
  summary: "Preventing and responding to abuse, neglect, exploitation and violence against children.",
  indicators: [
    cp.ind("CP-01", "Children reached with child protection services", { def: "Girls and boys who received case management, psychosocial support, family tracing or another service.", unit: "children", dims: ["SEX", "AGE", "DIS"], role: "children_cp_services", rec: true, mov: ["Case management database (confidential)"] }),
    cp.ind("CP-02", "Children in safe child-friendly spaces", { def: "Girls and boys who took part in activities in a child-friendly space in the period.", unit: "children", dims: ["SEX", "AGE"], role: "children_in_spaces", rec: true, mov: ["Attendance registers"] }),
    cp.ind("CP-03", "Unaccompanied and separated children in family or family-based care", { def: "Share of identified unaccompanied or separated children who are in family-based care or reunified.", kind: "RATE", dir: "H", level: "OUTCOME", role: "uasc_care", mov: ["Case records"], std: "Unaccompanied and separated children" }),
    cp.ind("CP-04", "Child protection cases managed with a case plan within agreed time", { def: "Share of open cases that have a case plan within the time the standard operating procedure sets.", kind: "RATE", dir: "H", mov: ["Case audit"] }),
    cp.ind("CP-05", "Caregivers reached with positive parenting support", { def: "Mothers, fathers and other caregivers who took part in parenting sessions.", unit: "caregivers", dims: ["SEX"], mov: ["Session registers"] }),
    cp.ind("CP-06", "Children and adolescents who report feeling safe", { def: "Share of surveyed children and adolescents who say they feel safe at home, at school and in the community.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE"], freq: "Per survey", mov: ["Child-friendly survey"] }),
    cp.ind("CP-07", "Community members trained to recognise and report child protection concerns", { def: "People trained in child protection and safe reporting.", unit: "people", dims: ["SEX"], mov: ["Training lists"] }),
    cp.ind("CP-08", "Children released or reintegrated from armed forces or groups", { def: "Children released from armed forces or groups who received reintegration support.", unit: "children", dims: ["SEX", "AGE"], mov: ["Case files"], also: ["PEACEBUILDING"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Girls and boys are protected from abuse, neglect, exploitation and violence" }, { key: "o-resp", level: "OUTCOME", title: "Children at risk receive quality case management and care", parent: "g" }, { key: "out-spaces", level: "OUTPUT", title: "Safe spaces and psychosocial support provided", parent: "o-resp" }, { key: "out-case", level: "OUTPUT", title: "Cases managed with plans and follow-up", parent: "o-resp" }],
  assessment: [{ key: "risks", question: "What are the main child protection risks for girls and boys of different ages?", answerType: "TEXT", why: "Shapes services.", required: true }, { key: "case-sop", question: "Is there a standard operating procedure for case management and referral?", answerType: "YES_NO", why: "Cases must follow an agreed route.", required: true }],
  forms: [{ key: "cfs-attendance", title: "Child-friendly space attendance", purpose: "Record attendance by sex and age group.", fields: [{ label: "Space", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Girls 0-5", type: "NUMBER", required: true }, { label: "Boys 0-5", type: "NUMBER", required: true }, { label: "Girls 6-17", type: "NUMBER", required: true }, { label: "Boys 6-17", type: "NUMBER", required: true }], feeds: ["CP-02"] }],
  evidence: [{ key: "cp-case-files", name: "Child protection case files", description: "Individual case plans and notes.", confidentiality: "HIGHLY_SENSITIVE" }, { key: "cp-safeguards", name: "Safe recruitment and code-of-conduct records", description: "Vetting and signed codes of conduct.", confidentiality: "SENSITIVE" }],
  checklist: [{ key: "child-safe-programming", title: "The team is trained and has signed a child safeguarding policy", description: "Everyone working with children has been vetted and trained.", severity: "critical", kind: "ATTESTATION", standard: "Child safeguarding" }],
  risks: [{ title: "A child is harmed in an activity", kind: "RISK", seriousness: "HIGH", mitigation: "Vet staff, use two adults and a clear reporting route." }, { title: "Families cannot be traced or reunited", kind: "PROBLEM", seriousness: "MEDIUM", mitigation: "Work with tracing services and community networks." }],
  glossary: [{ term: "Child-friendly space", meaning: "A safe place where children play, learn and receive support." }, { term: "Unaccompanied and separated children", meaning: "Children without a parent or usual caregiver." }],
  blueprint: [{ title: "Child protection results", guidance: "Children reached, case management and care outcomes." }],
});

const gb = sectorWriter({ sector: "GBV", src: "GBVIE_2019" });
gb.group("Gender-based violence prevention and response");
export const GBV = defineContent({
  sectorId: "GBV",
  summary: "Preventing gender-based violence, reducing risk, and supporting survivors with safe, confidential services.",
  indicators: [
    gb.ind("GBV-01", "Survivors receiving case management or psychosocial support", { def: "Survivors who received case management or psychosocial support (counts only; no identifying details).", unit: "survivors", dims: ["SEX", "AGE"], role: "survivors_supported", rec: true, mov: ["Case management database (confidential)"] }),
    gb.ind("GBV-02", "Survivors receiving clinical care in time", { def: "Share of survivors who reached clinical care within the time that matters (72 hours for post-exposure prophylaxis).", kind: "RATE", dir: "H", level: "OUTCOME", role: "gbv_clinical_in_time", mov: ["Health facility log (confidential)"], also: ["HEALTH"], src: "MISP" }),
    gb.ind("GBV-03", "Women and girls safe spaces active", { def: "Women and girls safe spaces that were open and in use in the period.", unit: "safe spaces", role: "safe_spaces", rec: true, mov: ["Activity registers"] }),
    gb.ind("GBV-04", "Women and girls using safe spaces", { def: "Women and girls who attended a safe space in the period.", unit: "women and girls", dims: ["AGE", "DIS"], mov: ["Attendance register"] }),
    gb.ind("GBV-05", "Service providers trained in survivor-centred care", { def: "Staff of health, police, legal and social services trained in survivor-centred care and referral.", unit: "people", dims: ["SEX"], mov: ["Training lists"] }),
    gb.ind("GBV-06", "People reached by prevention and risk-reduction activities", { def: "Women, girls, men and boys reached by sessions that address attitudes and risks of GBV.", unit: "people", dims: ["SEX", "AGE"], mov: ["Session registers"] }),
    gb.ind("GBV-07", "Women and girls who report feeling safe in the community", { def: "Share of surveyed women and girls who report feeling safe going to water, toilets, markets and distribution points.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["AGE"], freq: "Per survey", mov: ["Safety audit and perception survey"] }),
    gb.ind("GBV-08", "Sectors that have integrated GBV risk mitigation into their work", { def: "Number of other sectors with a GBV risk mitigation action plan in place.", unit: "sectors", agg: "LATEST", mov: ["Action plans"], src: "IASC", also: ["PROTECTION_AAP"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Women and girls live free from gender-based violence" }, { key: "o-resp", level: "OUTCOME", title: "Survivors receive safe, timely, survivor-centred services", parent: "g" }, { key: "o-prev", level: "OUTCOME", title: "Risks of GBV are reduced", parent: "g" }, { key: "out-case", level: "OUTPUT", title: "Case management and psychosocial support delivered", parent: "o-resp" }, { key: "out-safe", level: "OUTPUT", title: "Safe spaces and prevention activities run", parent: "o-prev" }],
  assessment: [{ key: "ssop", question: "Is there an agreed GBV referral pathway and standard operating procedure?", answerType: "YES_NO", why: "Survivors must reach safe care.", required: true }, { key: "safety", question: "What are the main risks to women and girls in the daily routine?", answerType: "TEXT", why: "Prevention and mitigation start here.", required: true }],
  forms: [{ key: "safe-space-attendance", title: "Safe space attendance", purpose: "Record attendance without names.", fields: [{ label: "Safe space", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Women", type: "NUMBER", required: true }, { label: "Girls", type: "NUMBER", required: true }], feeds: ["GBV-04"] }],
  evidence: [{ key: "gbv-safety-audit", name: "Safety audit", description: "Audit of facilities and routes for women and girls.", confidentiality: "SENSITIVE" }, { key: "gbv-case-files", name: "Survivor case files", description: "Held only by trained caseworkers.", confidentiality: "HIGHLY_SENSITIVE" }],
  checklist: [{ key: "survivor-centred", title: "Staff follow survivor-centred principles: safety, confidentiality, respect, non-discrimination", description: "The team is trained and the principles are in the SOP.", severity: "critical", kind: "ATTESTATION", standard: "GBV minimum standards" }],
  risks: [{ title: "A survivor is identified or put at risk", kind: "RISK", seriousness: "HIGH", mitigation: "Never record names in monitoring data; restrict access." }, { title: "Services are not trusted or accessible", kind: "PROBLEM", seriousness: "HIGH", mitigation: "Consult women and girls on the location, hours and staff." }],
  glossary: [{ term: "Survivor-centred", meaning: "Putting the survivor's safety, choices and dignity first." }, { term: "GBV risk mitigation", meaning: "Actions every sector takes to reduce the risk that its work exposes people to violence." }],
  blueprint: [{ title: "GBV response results", guidance: "Survivors reached, never identifying details." }, { title: "GBV prevention and risk reduction", guidance: "Reach, safety perception and mitigation." }],
});
