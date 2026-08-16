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

const HEADING_RE = /^(?:\d+\.?\s*|\(\d+\)\s*|\b(?:section|chapter|part|annex)\b[\s\d]*|[IVX]+\.?\s*)/i;
const UPPER_TITLE_RE = /^[A-Z][A-Z\s&\-/]{4,}$/;

function inferInputType(title: string): TemplateSection["inputType"] {
  const lower = title.toLowerCase();
  if (lower.includes("indicator") || lower.includes("results")) return "INDICATOR_TABLE";
  if (lower.includes("annex") || lower.includes("attachment") || lower.includes("appendix")) return "ANNEX";
  if (lower.includes("budget") || lower.includes("beneficiary") || lower.includes("disaggregation")) return "TABLE";
  if (lower.includes("compliance") || lower.includes("safeguarding") || lower.includes("psea")) return "COMPLIANCE";
  return "NARRATIVE";
}

function inferRequired(title: string, requiredHint: string | undefined): boolean {
  if (requiredHint !== undefined) return requiredHint !== "optional" && requiredHint !== "not required";
  const lower = title.toLowerCase();
  return !/optional|annex\s+\w|appendix/.test(lower) || /required/.test(lower);
}

export class StubTemplateExtractionService implements ITemplateExtractionService {
  async extractSections(input: { rawText: string; language: string; existingSections?: TemplateSection[] }): Promise<{ sections: TemplateSection[]; summary: string }> {
    const raw = input.rawText ?? "";
    const lines = raw.split(/\r?\n/);
    const detected: string[] = [];
    let sawTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 140) continue;
      const hasNumbering = HEADING_RE.test(trimmed);
      const upper = UPPER_TITLE_RE.test(trimmed);
      const isTableLine = /^\s*\|/.test(line) || /\t/.test(line);
      if (isTableLine) {
        sawTable = true;
        continue;
      }
      if ((hasNumbering || upper) && !/\s+\d{2,}$/.test(trimmed) && !trimmed.includes(".") && !/^(table|figure|note|source)\b/i.test(trimmed)) {
        const cleaned = trimmed.replace(/^(?:\d+\.?\s*|\(\d+\)\s*|[IVX]+\.?\s*|\b(?:section|chapter|part|annex)\b[\s\d]*:?\s*)/i, "").replace(/:$/g, "").trim();
        if (cleaned && cleaned.length >= 3 && !detected.includes(cleaned)) detected.push(cleaned);
      }
    }

    // 1) User-supplied existing sections win when regenerating.
    if (input.existingSections && input.existingSections.length > 0) {
      return {
        sections: input.existingSections.map((s) =>
          createSection({ title: s.title, description: s.description, inputType: s.inputType, required: s.required, evidenceNeeded: s.evidenceNeeded, reviewStatus: "REVIEWED" }),
        ),
        summary: `Kept ${input.existingSections.length} existing section(s). Review before saving.`,
      };
    }

    // 2) Detected headings from the raw text, else the canonical donor outline.
    const base =
      detected.length > 0
        ? detected.slice(0, 14).map((title) =>
            createSection({
              title,
              description: "",
              inputType: inferInputType(title),
              required: inferRequired(title, undefined),
              evidenceNeeded: "",
              reviewStatus: "REVIEWED",
            }),
          )
        : CANONICAL.map((c) => createSection({ ...c }));

    // 3) If the document contained tabular content and no "indicator" section was
    // detected, append an indicator table section so tabular data has a home.
    const hasIndicatorSection = base.some((s) => s.inputType === "INDICATOR_TABLE");
    if (sawTable && !hasIndicatorSection) {
      base.push(
        createSection({
          title: "Indicator Progress",
          description: "Indicator table with achievements.",
          inputType: "INDICATOR_TABLE",
          required: true,
          evidenceNeeded: "Indicator data",
          reviewStatus: "REVIEWED",
        }),
      );
    }

    const mode = detected.length > 0 ? "detected" : "canonical";
    const summary = `Extracted ${base.length} section(s) from the template (${input.language}, ${mode}). Review and edit before saving.`;
    return { sections: base, summary };
  }
}
