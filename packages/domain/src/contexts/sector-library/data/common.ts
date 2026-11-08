import type { AssessmentQuestion, BlueprintSection, LibraryChecklistItem, LibraryEvidenceType, GlossaryEntry, RiskSketch } from "../model.js";

/** What every sector offers (Phase 46): merged into each sector's pack by the part providers, so no sector file repeats it. */
export const COMMON_ASSESSMENT: readonly AssessmentQuestion[] = [
  { key: "context", question: "What is the context: who is affected, why, and what has changed recently?", answerType: "TEXT", why: "Every plan starts from the context.", required: true },
  { key: "vulnerable", question: "Which groups are most at risk of being left out (women, children, older people, people with disabilities, minorities)?", answerType: "TEXT", why: "Targeting and accessibility depend on it.", required: true },
  { key: "feedback", question: "How can people give feedback or make a complaint, and who answers?", answerType: "TEXT", why: "People must be able to raise concerns safely.", required: true },
  { key: "safeguarding", question: "Who is the safeguarding focal person and how do staff report a concern?", answerType: "TEXT", why: "Protects people from harm by staff and partners.", required: true },
  { key: "data-protection", question: "What personal data will be collected and how will it be kept safe?", answerType: "TEXT", why: "Data about people can put them at risk.", required: false },
];

export const COMMON_EVIDENCE: readonly LibraryEvidenceType[] = [
  { key: "needs-assessment", name: "Needs assessment report", description: "The assessment that shaped the response.", confidentiality: "INTERNAL" },
  { key: "feedback-log", name: "Feedback and complaints log", description: "Feedback received and how each was answered.", confidentiality: "SENSITIVE" },
  { key: "training-attendance", name: "Training attendance list", description: "Who attended a training and when.", confidentiality: "INTERNAL" },
];

export const COMMON_CHECKLIST: readonly LibraryChecklistItem[] = [
  { key: "do-no-harm", title: "A do-no-harm review was done", description: "Ways the project could expose people to further harm were considered and addressed.", severity: "high", kind: "ATTESTATION", standard: "Protection Principle 1" },
  { key: "feedback-channel", title: "A feedback and complaints channel is working", description: "People know how to use it and it is answered within the stated time.", severity: "high", kind: "ATTESTATION", standard: "CHS Commitments 4 and 5" },
  { key: "impartial-access", title: "Help reaches people by need, without discrimination", description: "Targeting criteria were applied fairly and checked.", severity: "high", kind: "ATTESTATION", standard: "Protection Principle 2" },
];

export const COMMON_RISKS: readonly RiskSketch[] = [
  { title: "Staff leave during the project", kind: "RISK", seriousness: "MEDIUM", mitigation: "Keep a handover note for every role." },
  { title: "Funds arrive later than planned", kind: "RISK", seriousness: "MEDIUM", mitigation: "Agree a payment calendar with the donor." },
  { title: "Access is limited by insecurity or weather", kind: "RISK", seriousness: "MEDIUM", mitigation: "Keep a flexible plan and agree alternative routes." },
];

export const COMMON_GLOSSARY: readonly GlossaryEntry[] = [
  { term: "Disaggregation", meaning: "Splitting a figure by sex, age, disability or place to see who is reached." },
  { term: "Reference standard", meaning: "A published minimum or benchmark to compare with. It is not your target until you confirm it." },
];

export const COMMON_BLUEPRINT: readonly BlueprintSection[] = [
  { title: "Context and needs", guidance: "What changed, who is affected and how the response was shaped." },
  { title: "Accountability to affected people", guidance: "Consultation, feedback received and how it was used." },
];
