import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const ap = sectorWriter({ sector: "PROTECTION_AAP", src: "CHS_2014" });
ap.group("Participation, feedback and complaints");
export const PROTECTION_AAP = defineContent({
  sectorId: "PROTECTION_AAP",
  summary: "The Protection Principles and the Core Humanitarian Standard commitments that every project answers to.",
  indicators: [
    ap.ind("AAP-01", "People consulted in the design or monitoring of the project", { def: "People who took part in consultations or monitoring discussions, by sex, age and disability.", unit: "people", dims: ["SEX", "AGE", "DIS"], role: "people_consulted", rec: true, std: "Commitment 4", mov: ["Consultation records"] }),
    ap.ind("AAP-02", "Feedback and complaints received", { def: "Feedback and complaints received through all channels in the period.", unit: "items", dir: "N", freq: "Monthly", role: "feedback_received", rec: true, std: "Commitment 5", mov: ["Feedback log"] }),
    ap.ind("AAP-03", "Complaints answered within the stated time", { def: "Share of complaints that received an answer within the time the mechanism promises.", kind: "RATE", num: "Complaints answered in time", den: "Complaints received", dir: "H", level: "OUTCOME", freq: "Monthly", role: "complaints_on_time", rec: true, std: "Commitment 5", mov: ["Feedback log"] }),
    ap.ind("AAP-04", "Sexual exploitation and abuse reports referred according to procedure", { def: "Share of reports referred to the right focal point within the agreed time.", kind: "RATE", dir: "H", freq: "Monthly", std: "Commitment 5", mov: ["PSEA report log (confidential)"] }),
    ap.ind("AAP-05", "People who say they feel safe using project facilities and distributions", { def: "Share of surveyed people who say they feel safe.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX", "AGE", "DIS"], freq: "Quarterly", std: "Protection Principle 3", mov: ["Safety audit and survey"] }),
    ap.ind("AAP-06", "People who say aid reached those most in need", { def: "Share of surveyed people who say assistance went to those who most needed it.", kind: "RATE", dir: "H", level: "OUTCOME", freq: "Annual", std: "Commitment 1", mov: ["Perception survey"] }),
    ap.ind("AAP-07", "Staff who completed code-of-conduct and PSEA training", { def: "Share of staff and volunteers who completed training and signed the code of conduct.", kind: "RATE", dir: "H", freq: "Annual", std: "Commitment 8", mov: ["Training records"] }),
    ap.ind("AAP-08", "Activities with a documented do-no-harm review", { def: "Share of activities with a written review of how they could expose people to harm.", kind: "RATE", dir: "H", freq: "Annual", std: "Protection Principle 1", mov: ["Review records"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People are treated with dignity and take part in decisions that affect them" }, { key: "o-acc", level: "OUTCOME", title: "People can give feedback and get answers", parent: "g", standards: ["CHS Commitments 4 and 5"] }, { key: "out-mech", level: "OUTPUT", title: "A feedback and complaints mechanism is working", parent: "o-acc" }],
  assessment: [{ key: "channels", question: "Which feedback channels do people prefer and can use?", answerType: "TEXT", why: "A channel nobody uses is not a channel.", required: true }],
  forms: [{ key: "feedback", title: "Feedback record", purpose: "Record feedback or a complaint without naming the person.", fields: [{ label: "Date", type: "DATE", required: true }, { label: "Channel", type: "CHOICE", required: true, choices: ["Hotline", "Box", "Face to face", "Community committee", "Other"] }, { label: "Topic", type: "TEXT", required: true }, { label: "Answered", type: "YES_NO", required: true }], feeds: ["AAP-02", "AAP-03"] }],
  evidence: [{ key: "feedback-report", name: "Feedback analysis", description: "Themes and actions taken.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Feedback mechanisms are not trusted", kind: "RISK", seriousness: "HIGH", mitigation: "Co-design channels with the community and show what changed." }],
  glossary: [{ term: "Accountability to affected people", meaning: "Using power responsibly by taking account of, giving account to, and being held to account by the people we serve." }],
  blueprint: [{ title: "Accountability to affected people", guidance: "Consultation, feedback and what changed." }],
  noneBecause: { checklist: "The common checklist already carries the Protection and CHS items." },
});

const me = sectorWriter({ sector: "MEAL", src: "DONORDESK" });
me.group("Monitoring, evaluation, accountability and learning");
export const MEAL = defineContent({
  sectorId: "MEAL",
  summary: "How a project measures results, learns and reports honestly.",
  indicators: [
    me.ind("MEAL-01", "Indicators with a baseline", { def: "Share of the project's indicators that have a baseline or a stated reason for none.", kind: "RATE", dir: "H", freq: "Annual", role: "baselines_set", rec: true, mov: ["Logframe"] }),
    me.ind("MEAL-02", "Data entered on time", { def: "Share of due indicator values entered within the entry window.", kind: "RATE", dir: "H", freq: "Monthly", role: "data_on_time", rec: true, mov: ["System entry log"] }),
    me.ind("MEAL-03", "Values verified with evidence", { def: "Share of reported values with supporting evidence attached.", kind: "RATE", dir: "H", freq: "Quarterly", role: "values_with_evidence", rec: true, mov: ["Evidence register"] }),
    me.ind("MEAL-04", "Data quality assessments completed", { def: "Data quality assessments completed in the period.", unit: "assessments", role: "dqa_done", mov: ["Assessment reports"] }),
    me.ind("MEAL-05", "Learning reviews held and actions agreed", { def: "Reflection or learning reviews held with agreed actions.", unit: "reviews", mov: ["Review minutes"] }),
    me.ind("MEAL-06", "Evaluations completed", { def: "Mid-term or final evaluations completed and shared.", unit: "evaluations", mov: ["Evaluation reports"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "The project learns and reports results reliably" }, { key: "o-data", level: "OUTCOME", title: "Good-quality data guide decisions", parent: "g" }, { key: "out-sys", level: "OUTPUT", title: "Monitoring plan and tools in use", parent: "o-data" }],
  assessment: [{ key: "plan", question: "Is there a monitoring plan covering indicators, sources, frequency and responsibilities?", answerType: "YES_NO", why: "The plan makes data collection routine.", required: true }],
  forms: [], evidence: [{ key: "meal-plan", name: "Monitoring plan", description: "Indicators, methods, frequency, owners.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Data are late or incomplete", kind: "RISK", seriousness: "MEDIUM", mitigation: "Use entry windows, reminders and a named owner for each indicator." }],
  glossary: [{ term: "Baseline", meaning: "The starting value before the project's work." }],
  blueprint: [{ title: "Monitoring and learning", guidance: "Data quality, evidence and lessons." }],
  noneBecause: { forms: "MEAL indicators are read from the system itself.", checklist: "Covered by the common checklist." },
});

const fg = sectorWriter({ sector: "FINANCE_GRANTS", src: "DONORDESK" });
fg.group("Grants and finance management");
export const FINANCE_GRANTS = defineContent({
  sectorId: "FINANCE_GRANTS",
  summary: "Spending as planned, on time, and accounting for it.",
  indicators: [
    fg.ind("FIN-01", "Budget spent as a share of time elapsed", { def: "Expenditure to date as a share of the budget, set beside the share of project time that has passed.", kind: "RATE", dir: "N", freq: "Monthly", role: "burn_rate", rec: true, mov: ["Finance reports"] }),
    fg.ind("FIN-02", "Financial reports submitted on time", { def: "Share of due financial reports submitted by the deadline.", kind: "RATE", dir: "H", freq: "Quarterly", role: "fin_reports_on_time", rec: true, mov: ["Submission log"] }),
    fg.ind("FIN-03", "Expenditure with complete supporting documents", { def: "Share of sampled expenditure with complete, valid supporting documents.", kind: "RATE", dir: "H", freq: "Quarterly", role: "expenditure_documented", rec: true, mov: ["Spot checks"] }),
    fg.ind("FIN-04", "Funding passed to partners on schedule", { def: "Share of partner payments made on the agreed date.", kind: "RATE", dir: "H", mov: ["Payment records"], also: ["LOCALISATION"] }),
    fg.ind("FIN-05", "Audit findings resolved", { def: "Share of audit findings with closed actions.", kind: "RATE", dir: "H", freq: "Annual", mov: ["Audit follow-up"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "Funds are used as agreed and accounted for" }, { key: "o-fin", level: "OUTCOME", title: "Spending is on plan and well documented", parent: "g" }, { key: "out-rep", level: "OUTPUT", title: "Financial reports submitted on time", parent: "o-fin" }],
  assessment: [{ key: "controls", question: "Which financial controls and approvals are in place?", answerType: "TEXT", why: "Reduces loss and fraud.", required: true }],
  forms: [], evidence: [{ key: "financial-report", name: "Financial report", description: "Budget against expenditure for the period.", confidentiality: "INTERNAL" }],
  checklist: [], risks: [{ title: "Costs overrun or funds are disallowed", kind: "RISK", seriousness: "HIGH", mitigation: "Review spend monthly and keep complete documents." }],
  glossary: [{ term: "Burn rate", meaning: "How fast the budget is being spent." }],
  blueprint: [{ title: "Financial overview", guidance: "Budget against expenditure, with reasons for variances." }],
  noneBecause: { forms: "Finance data are entered in the finance register.", checklist: "Covered by the common checklist." },
});

const sg = sectorWriter({ sector: "SAFEGUARDING", src: "CHS_2014" });
sg.group("Safeguarding and prevention of sexual exploitation and abuse");
export const SAFEGUARDING = defineContent({
  sectorId: "SAFEGUARDING",
  summary: "Preventing harm by staff, partners and volunteers, and responding well when it happens.",
  indicators: [
    sg.ind("SAFE-01", "Staff and volunteers who completed safeguarding training", { def: "Share of staff and volunteers who completed safeguarding and PSEA training in the period.", kind: "RATE", dir: "H", role: "staff_safeguarding_trained", rec: true, std: "Commitment 8", mov: ["Training records"] }),
    sg.ind("SAFE-02", "Partners with a safeguarding policy and focal point", { def: "Share of partners with a written policy and a named focal point.", kind: "RATE", dir: "H", role: "partners_safeguarding", rec: true, mov: ["Partner assessments"] }),
    sg.ind("SAFE-03", "Staff recruited with safe recruitment checks", { def: "Share of new staff recruited with reference and background checks.", kind: "RATE", dir: "H", mov: ["HR records"] }),
    sg.ind("SAFE-04", "Concerns reported and handled within the stated time", { def: "Share of safeguarding concerns that were acknowledged and assessed within the stated time.", kind: "RATE", dir: "H", level: "OUTCOME", mov: ["Case log (confidential)"] }),
    sg.ind("SAFE-05", "Communities informed how to report concerns", { def: "People who know how to report a safeguarding concern.", unit: "people", dims: ["SEX", "AGE"], mov: ["Community sessions"] }),
  ],
  logframe: [{ key: "g", level: "GOAL", title: "People are safe from harm caused by the people and organisations that serve them" }, { key: "o-safe", level: "OUTCOME", title: "Staff behave safely and concerns are handled well", parent: "g" }, { key: "out-train", level: "OUTPUT", title: "Staff and partners trained and checked", parent: "o-safe" }],
  assessment: [{ key: "policy", question: "Is there a safeguarding policy, a focal point and a reporting procedure?", answerType: "YES_NO", why: "The first line of protection.", required: true }],
  forms: [], evidence: [{ key: "safeguarding-policy", name: "Safeguarding policy and code of conduct", description: "Signed policy documents.", confidentiality: "INTERNAL" }],
  checklist: [{ key: "safeguarding-procedure", title: "Reports are handled by a trained focal point under a clear procedure", description: "The procedure protects the person who reports.", severity: "critical", kind: "ATTESTATION", standard: "CHS Commitment 5" }],
  risks: [{ title: "A concern is not reported or is mishandled", kind: "RISK", seriousness: "HIGH", mitigation: "Train, make reporting easy, and protect those who report." }],
  glossary: [{ term: "PSEA", meaning: "Protection from sexual exploitation and abuse by those who work for aid organisations." }],
  blueprint: [{ title: "Safeguarding", guidance: "Training, partner capacity and handling of concerns, never case details." }],
  noneBecause: { forms: "Reports are handled in confidential case management, not a collection form." },
});
