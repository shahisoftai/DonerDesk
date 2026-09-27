import type { SectionDraft } from "./section-tree.js";

/** A generic donor report outline, offered only when no structure can be detected. */
export const CANONICAL_OUTLINE: SectionDraft[] = [
  { ref: "c1", title: "Executive Summary", description: "Overview of the reporting period.", inputType: "NARRATIVE", required: true, evidenceNeeded: ["Activity summaries"], minWords: 200, maxWords: 400 },
  { ref: "c2", title: "Project Progress", description: "Status of activities against the plan.", inputType: "NARRATIVE", required: true, evidenceNeeded: ["Activity updates"], minWords: 400, maxWords: 600 },
  { ref: "c3", title: "Indicator Progress", description: "Achievements against baselines and targets.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: ["Indicator data"], minWords: 100, maxWords: 300 },
  { ref: "c4", title: "Achievements", description: "Key achievements of the period.", inputType: "NARRATIVE", required: true, evidenceNeeded: ["Verified evidence"], minWords: 200, maxWords: 500 },
  { ref: "c5", title: "Challenges", description: "Challenges encountered and mitigation.", inputType: "NARRATIVE", required: true, evidenceNeeded: ["Field reports"], minWords: 200, maxWords: 500 },
  { ref: "c6", title: "Lessons Learned", description: "Insights and adaptations.", inputType: "NARRATIVE", required: false, minWords: 100, maxWords: 300 },
  { ref: "c7", title: "Risks & Mitigation", description: "Top risks and mitigation steps.", inputType: "NARRATIVE", required: false, evidenceNeeded: ["Risk register"], minWords: 100, maxWords: 300 },
  { ref: "c8", title: "Beneficiary Reach", description: "Disaggregation by sex, age and disability.", inputType: "TABLE", required: true, evidenceNeeded: ["Attendance sheets", "Distribution lists"], minWords: 100, maxWords: 300 },
  { ref: "c9", title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: ["All verified evidence"], minWords: 20, maxWords: 100 },
];
