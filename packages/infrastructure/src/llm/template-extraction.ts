import type { ITemplateExtractionService } from "@donordesk/application";
import type { TemplateSection } from "@donordesk/domain";
import { createSection } from "@donordesk/domain";

const CANONICAL: Array<{ title: string; description: string; inputType: "NARRATIVE" | "TABLE" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE"; required: boolean; evidenceNeeded: string; reviewStatus: "REVIEWED" }> = [
  { title: "Executive Summary", description: "Overview of the reporting period.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", reviewStatus: "REVIEWED" },
  { title: "Project Progress", description: "Status of activities vs. plan.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity updates", reviewStatus: "REVIEWED" },
  { title: "Indicator Progress", description: "Indicator table with achievements.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Indicator data", reviewStatus: "REVIEWED" },
  { title: "Achievements", description: "Key achievements of the period.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Verified evidence", reviewStatus: "REVIEWED" },
  { title: "Challenges", description: "Challenges encountered and mitigation.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field reports", reviewStatus: "REVIEWED" },
  { title: "Lessons Learned", description: "Insights and adaptations.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", reviewStatus: "REVIEWED" },
  { title: "Risks & Mitigation", description: "Top risks and mitigation steps.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", reviewStatus: "REVIEWED" },
  { title: "Beneficiary Reach", description: "Disaggregation by sex, age, disability.", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets, distribution lists", reviewStatus: "REVIEWED" },
  { title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence", reviewStatus: "REVIEWED" },
];

export class StubTemplateExtractionService implements ITemplateExtractionService {
  async extractSections(input: { rawText: string; language: string; existingSections?: TemplateSection[] }): Promise<{ sections: TemplateSection[]; summary: string }> {
    // Heuristic: detect headings in raw text (lines that look like numbered or titled sections).
    const lines = (input.rawText ?? "").split(/\r?\n/);
    const detected: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(section|chapter|part|\d+\.|(\d+\.)+\d*)\s+/i.test(trimmed) && trimmed.length < 120) {
        detected.push(trimmed.replace(/^(\d+\.)+\s*/, ""));
      }
    }
    const base = detected.length > 0
      ? detected.slice(0, 12).map((title) =>
          createSection({ title, description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "", reviewStatus: "REVIEWED" }),
        )
      : CANONICAL.map((c) => createSection({ ...c }));
    const summary = `Extracted ${base.length} sections from the uploaded template (${input.language}). Review and edit before saving.`;
    return { sections: base, summary };
  }
}
