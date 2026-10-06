const EXTENSIONS: Record<string, string> = {
  WORD: "docx",
  PDF: "pdf",
  EXCEL_INDICATORS: "xlsx",
  EVIDENCE_CHECKLIST: "csv",
  EVIDENCE_PACK_ZIP: "zip",
  DONOR_TEMPLATE: "docx",
};

function slug(s: string, max: number): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}

const day = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The name a downloaded export gets, e.g.
 * `learning-recovery-for-displaced-children-final-2026-08-01-to-2026-08-31-v3-draft.docx`:
 * project, kind of report, period, report version, and "-internal" for a review copy or "-final" for the donor copy.
 */
export function exportFileName(input: {
  projectTitle: string;
  reportType?: string;
  periodStart: Date;
  periodEnd: Date;
  version?: number;
  exportType: string;
  intent: "INTERNAL_REVIEW" | "DONOR_SUBMISSION";
}): string {
  const parts = [
    slug(input.projectTitle, 60) || "report",
    input.reportType ? slug(input.reportType, 20) : "",
    `${day(input.periodStart)}-to-${day(input.periodEnd)}`,
    input.version ? `v${input.version}` : "",
    input.exportType === "EXCEL_INDICATORS" ? "indicators" : input.exportType === "EVIDENCE_CHECKLIST" ? "evidence-checklist" : input.exportType === "EVIDENCE_PACK_ZIP" ? "evidence-pack" : "",
    // A document says which copy it is: "-final" is the sealed donor copy, "-internal" carries the review watermark
    // (never "-draft": an approved report exported for review is not a draft).
    input.exportType === "WORD" || input.exportType === "PDF" ? (input.intent === "DONOR_SUBMISSION" ? "final" : "internal") : "",
  ].filter(Boolean);
  return `${parts.join("-")}.${EXTENSIONS[input.exportType] ?? "bin"}`;
}
