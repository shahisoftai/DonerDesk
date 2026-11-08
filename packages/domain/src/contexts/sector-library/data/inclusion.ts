import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const ge = sectorWriter({ sector: "GENDER_EQUALITY", src: "SDG" });
ge.group("Gender equality and women's empowerment");
export const GENDER_EQUALITY = defineContent({
  sectorId: "GENDER_EQUALITY",
  summary: "Equal rights, voice and opportunity for women, girls, men and boys.",
  indicators: [
    ge.ind("GEN-01", "Women and girls reached by empowerment activities", { def: "Women and girls who took part in leadership, rights, skills or savings activities.", unit: "people", dims: ["AGE", "DIS"], role: "women_empowerment_reach", rec: true, mov: ["Attendance registers"] }),
    ge.ind("GEN-02", "Women in leadership or decision-making roles", { def: "Women holding leadership or decision-making roles in supported groups.", unit: "women", role: "women_leaders", rec: true, mov: ["Membership and role lists"] }),
    ge.ind("GEN-03", "Projects with gender analysis and a gender action plan", { def: "Projects with a documented gender analysis that shaped the plan.", unit: "projects", role: "projects_gender_analysis", mov: ["Project documents"] }),
    ge.ind("GEN-04", "Men and boys engaged in gender-equality activities", { def: "Men and boys who took part in sessions on gender norms and equality.", unit: "people", dims: ["AGE"], role: "men_engaged", mov: ["Attendance registers"] }),
    ge.ind("GEN-05", "Women with control over their own income", { def: "Share of surveyed women who decide how to use their own income.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Annual", mov: ["Household survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Women and girls and men and boys enjoy equal rights and opportunities" }, { key: "o-voice", level: "OUTCOME", title: "Women and girls have more voice and control", parent: "g" }, { key: "out-act", level: "OUTPUT", title: "Empowerment and norms activities delivered", parent: "o-voice" }],
  assessment: [{ key: "gender-analysis", question: "What does a gender analysis show about roles, access and barriers?", answerType: "TEXT", why: "Shapes the project.", required: true }],
  forms: [], evidence: [{ key: "gender-analysis-report", name: "Gender analysis", description: "Analysis of roles, power and barriers.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Backlash against women who take part", kind: "RISK", seriousness: "HIGH", mitigation: "Engage men and leaders, and monitor safety." }],
  glossary: [{ term: "Gender analysis", meaning: "A study of how roles and power differ for women, men, girls and boys." }],
  blueprint: [{ title: "Gender equality results", guidance: "Reach, leadership and control." }],
  noneBecause: { forms: "Data come from registers and surveys.", checklist: "Covered by the common checklist." },
});

const di = sectorWriter({ sector: "DISABILITY_INCLUSION", src: "IASC" });
di.group("Disability inclusion");
export const DISABILITY_INCLUSION = defineContent({
  sectorId: "DISABILITY_INCLUSION",
  summary: "Making services accessible to and led by people with disabilities.",
  indicators: [
    di.ind("DIS-01", "People with disabilities reached", { def: "People with disabilities who received support; report by sex and age.", unit: "people", dims: ["SEX", "AGE"], role: "pwd_reached", rec: true, mov: ["Service registers"] }),
    di.ind("DIS-02", "Facilities made accessible", { def: "Water points, toilets, shelters, schools or health facilities adapted for access.", unit: "facilities", role: "facilities_accessible", rec: true, mov: ["Accessibility audit"] }),
    di.ind("DIS-03", "Assistive devices provided", { def: "Wheelchairs, hearing aids, white canes and other devices provided.", unit: "devices", role: "assistive_devices", rec: true, mov: ["Distribution lists"] }),
    di.ind("DIS-04", "Staff trained in disability inclusion", { def: "Staff and partners trained on inclusion and communication.", unit: "people", dims: ["SEX"], role: "staff_trained_inclusion", mov: ["Training lists"] }),
    di.ind("DIS-05", "Organisations of persons with disabilities supported", { def: "Organisations led by persons with disabilities that received capacity or funding support.", unit: "organisations", mov: ["Support records"] }),
    di.ind("DIS-06", "People with disabilities who report they can use services", { def: "Share of surveyed people with disabilities who say they can reach and use services without barriers.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE"], mov: ["Washington Group questions in survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People with disabilities take part fully and on an equal basis" }, { key: "o-access", level: "OUTCOME", title: "Services and information are accessible", parent: "g" }, { key: "out-adapt", level: "OUTPUT", title: "Facilities adapted and devices provided", parent: "o-access" }],
  assessment: [{ key: "barriers", question: "What barriers do people with different disabilities face?", answerType: "TEXT", why: "Sets adaptations.", required: true }],
  forms: [], evidence: [{ key: "access-audit", name: "Accessibility audit", description: "Checks of physical and information access.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "People with disabilities are not identified or consulted", kind: "RISK", seriousness: "HIGH", mitigation: "Work with disability organisations and use the Washington Group questions." }],
  glossary: [{ term: "Washington Group questions", meaning: "A short set of survey questions to identify people with difficulty in daily activities." }],
  blueprint: [{ title: "Inclusion results", guidance: "Reach, access and participation." }],
  noneBecause: { forms: "Data come from service registers and audits.", checklist: "Covered by the common checklist." },
});

const mg = sectorWriter({ sector: "MIGRATION_DISPLACEMENT", src: "UNHCR_RBM" });
mg.group("Migration, refugees and displacement");
export const MIGRATION_DISPLACEMENT = defineContent({
  sectorId: "MIGRATION_DISPLACEMENT",
  summary: "Protection, assistance and solutions for refugees, internally displaced people, returnees and migrants.",
  indicators: [
    mg.ind("MIG-01", "Displaced people registered or documented", { def: "Refugees, IDPs, returnees or migrants who are registered or hold documents.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_registered", rec: true, mov: ["Registration system"] }),
    mg.ind("MIG-02", "People receiving information about their rights and services", { def: "People who received information on rights, services and procedures.", unit: "people", dims: ["SEX", "AGE"], role: "people_informed", rec: true, mov: ["Information desk records"] }),
    mg.ind("MIG-03", "People supported to reach a durable solution", { def: "People who returned, integrated or resettled with support.", unit: "people", dims: ["SEX", "AGE"], level: "OUTCOME", role: "people_solutions", rec: true, mov: ["Case records"] }),
    mg.ind("MIG-04", "Displaced people with access to the labour market or livelihood", { def: "Share of displaced people who can work or run a business legally.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], role: "people_work_access", mov: ["Household survey"], also: ["ECONOMIC_DEVELOPMENT"] }),
    mg.ind("MIG-05", "Displaced children enrolled in school", { def: "Share of school-age displaced children enrolled in school.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], mov: ["School records"], also: ["EDUCATION"] }),
    mg.ind("MIG-07", "People supported with return, integration or resettlement services", { def: "People who received counselling, transport, grants or other help towards return, local integration or resettlement.", unit: "people", dims: ["SEX", "AGE"], role: "people_solution_services", rec: true, mov: ["Case records"], std: "Durable solutions" }),
    mg.ind("MIG-06", "Host community members benefiting", { def: "Host community members who benefited from services or projects together with displaced people.", unit: "people", dims: ["SEX", "AGE"], mov: ["Programme records"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Displaced people are protected, included and find lasting solutions" }, { key: "o-prot", level: "OUTCOME", title: "People hold legal status and know their rights", parent: "g" }, { key: "o-sol", level: "OUTCOME", title: "People move towards durable solutions", parent: "g" }, { key: "out-reg", level: "OUTPUT", title: "People registered and informed", parent: "o-prot" }, { key: "out-sol", level: "OUTPUT", title: "People supported towards a lasting solution", parent: "o-sol" }],
  assessment: [{ key: "population", question: "Who is displaced, where from, and how long have they been displaced?", answerType: "TEXT", why: "Solutions depend on the situation.", required: true }],
  forms: [], evidence: [{ key: "registration-extract", name: "Registration extract", description: "Counts of people registered.", confidentiality: "HIGHLY_SENSITIVE" }],
  checklist: [], risks: [{ title: "Movement restrictions or deportation", kind: "RISK", seriousness: "HIGH", mitigation: "Monitor, advocate and keep contingency plans." }],
  glossary: [{ term: "Durable solution", meaning: "A lasting end to displacement: return, local integration or resettlement." }],
  blueprint: [{ title: "Protection and solutions", guidance: "Registration, information and solutions achieved." }],
  noneBecause: { forms: "Data come from registration systems.", checklist: "Covered by the common checklist." },
});

const mh = sectorWriter({ sector: "MHPSS", src: "IASC" });
mh.group("Mental health and psychosocial support");
export const MHPSS = defineContent({
  sectorId: "MHPSS",
  summary: "Mental health and psychosocial support across all layers of the intervention pyramid.",
  indicators: [
    mh.ind("MH-01", "People reached by MHPSS activities", { def: "People who took part in community or focused MHPSS activities.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "mhpss_reach", rec: true, mov: ["Activity registers"] }),
    mh.ind("MH-02", "People receiving individual or group mental health care", { def: "People who received specialised mental health care from a trained provider.", unit: "people", dims: ["SEX", "AGE"], role: "mh_care", rec: true, mov: ["Clinical records (confidential)"] }),
    mh.ind("MH-03", "Non-specialists trained in basic psychosocial support", { def: "Staff and volunteers trained in psychological first aid or basic support.", unit: "people", dims: ["SEX"], role: "nonspecialists_trained", rec: true, mov: ["Training lists"] }),
    mh.ind("MH-04", "Primary care facilities offering mental health services", { def: "Facilities with a trained provider and essential medicines for mental health.", unit: "facilities", agg: "LATEST", role: "facilities_mh", mov: ["Facility assessment"], also: ["HEALTH"] }),
    mh.ind("MH-05", "People reporting improved wellbeing after support", { def: "Share of people supported who show improved wellbeing on an agreed scale.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE"], mov: ["Pre- and post-support scale"], src: "WHO" }),
    mh.ind("MH-06", "People referred to specialist care who attended", { def: "Share of people referred to specialist mental health care who attended.", kind: "RATE", dir: "H", mov: ["Referral tracker"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People's mental health and psychosocial wellbeing improve" }, { key: "o-support", level: "OUTCOME", title: "People receive appropriate support at every layer", parent: "g" }, { key: "out-comm", level: "OUTPUT", title: "Community and family support delivered", parent: "o-support" }, { key: "out-spec", level: "OUTPUT", title: "Focused and specialised care available", parent: "o-support" }],
  assessment: [{ key: "needs", question: "What are the main sources of distress and existing supports?", answerType: "TEXT", why: "Shapes layers of support.", required: true }],
  forms: [], evidence: [{ key: "mhpss-registers", name: "MHPSS activity register", description: "Counts of people reached.", confidentiality: "SENSITIVE" }],
  checklist: [{ key: "mhpss-ethics", title: "Staff are trained and know when to refer; records are confidential", description: "No one provides care beyond their training.", severity: "critical", kind: "ATTESTATION", standard: "IASC MHPSS guidelines" }],
  risks: [{ title: "Stigma stops people from seeking help", kind: "PROBLEM", seriousness: "MEDIUM", mitigation: "Use community-based, non-stigmatising approaches." }],
  glossary: [{ term: "Psychological first aid", meaning: "Basic, caring support for someone in distress, without pressing them to talk." }],
  blueprint: [{ title: "MHPSS results", guidance: "People reached by layer and outcomes." }],
  noneBecause: { forms: "Records are individual and confidential; the project reports totals." },
});

const lc = sectorWriter({ sector: "LOCALISATION", src: "DONORDESK" });
lc.group("Localisation and capacity strengthening");
export const LOCALISATION = defineContent({
  sectorId: "LOCALISATION",
  summary: "Strengthening local and national organisations and shifting power and funding to them.",
  indicators: [
    lc.ind("LOC-01", "Local organisations receiving capacity strengthening", { def: "Local and national organisations that completed a capacity plan with support.", unit: "organisations", role: "local_orgs_supported", rec: true, mov: ["Capacity plans"] }),
    lc.ind("LOC-02", "Funding passed to local and national organisations", { def: "Share of project funding passed to local and national partners.", kind: "RATE", dir: "H", role: "funding_to_local", rec: true, mov: ["Partner agreements", "Finance records"], also: ["FINANCE_GRANTS"] }),
    lc.ind("LOC-03", "Partners that improved on their capacity assessment", { def: "Partners whose assessment score rose between baseline and endline.", unit: "partners", level: "OUTCOME", role: "partners_improved", rec: true, mov: ["Capacity assessments"] }),
    lc.ind("LOC-04", "Local staff in leadership roles of the project", { def: "Local or national staff in project leadership roles.", unit: "people", dims: ["SEX"], role: "local_leaders", mov: ["Staff lists"] }),
    lc.ind("LOC-05", "Partners who say they are treated as equals", { def: "Share of surveyed partners who report an equal, respectful relationship.", kind: "RATE", dir: "H", level: "OUTCOME", mov: ["Partner survey"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Local and national organisations lead the response" }, { key: "o-cap", level: "OUTCOME", title: "Partners have the capacity and resources to lead", parent: "g" }, { key: "out-cap", level: "OUTPUT", title: "Capacity plans carried out", parent: "o-cap" }],
  assessment: [{ key: "partner-assessment", question: "How were partners' strengths and needs assessed?", answerType: "TEXT", why: "Support must fit.", required: true }],
  forms: [], evidence: [{ key: "partner-assessment-report", name: "Partner capacity assessment", description: "Scores and plans for each partner.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Partners lack systems to manage funds", kind: "RISK", seriousness: "MEDIUM", mitigation: "Agree a staged plan with support and oversight." }],
  glossary: [{ term: "Localisation", meaning: "Shifting leadership, funding and decisions to local and national organisations." }],
  blueprint: [{ title: "Partnership and capacity results", guidance: "Funding, capacity gains and partner views." }],
  noneBecause: { forms: "Data come from assessments and agreements.", checklist: "Covered by the common checklist." },
});
