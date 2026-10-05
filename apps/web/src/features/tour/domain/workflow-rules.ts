/**
 * The order of work in DonorDesk and the five rules that surprise people, written once. The
 * tour, the "How it works" page and contextual hints all read from here, so the wording can
 * never differ between them. Pure module (no imports) so it is unit-testable with node --test.
 */
export const WORKFLOW_ORDER = [
  { key: "project", label: "Create and activate the project" },
  { key: "logframe", label: "Build the logframe" },
  { key: "indicators", label: "Define indicators and confirm how each is calculated" },
  { key: "template", label: "Add and approve the donor template" },
  { key: "period", label: "Create a reporting period" },
  { key: "data", label: "Enter and verify indicator data" },
  { key: "evidence", label: "Attach evidence" },
  { key: "generate", label: "Generate the draft" },
  { key: "review", label: "Review and approve" },
  { key: "export", label: "Export" },
] as const;

export type WorkflowKey = (typeof WORKFLOW_ORDER)[number]["key"];

export interface WorkflowRule {
  key: string;
  title: string;
  body: string;
  /** The tour step the rule is shown with. */
  stepId: string;
}

export const WORKFLOW_RULES: readonly WorkflowRule[] = [
  {
    key: "calculation",
    title: "Confirm how each indicator is calculated",
    stepId: "logframe-indicators",
    body:
      "Every indicator shows how reports will use it, e.g. “Counts: summed across periods” or “Rate: latest reported value”. " +
      "Until you confirm it, the report only describes the indicator and does not say whether it is on track. Confirm in one click, or choose another calculation.",
  },
  {
    key: "periods",
    title: "Reporting periods follow rules",
    stepId: "reporting-period",
    body:
      "Monthly, quarterly, semi-annual and annual periods follow one another without overlap, and a final report closes them. " +
      "Finance can be reported on quarterly, semi-annual, annual and final reports. A custom report is a one-off over any dates. The “What you can create” panel shows what is available now and why.",
  },
  {
    key: "evidence",
    title: "Attached evidence is proof",
    stepId: "evidence",
    body:
      "A file counts as proof in reports once it is attached to an activity or an indicator value. Choose what a file supports when you upload it and it is attached straight away. " +
      "Each activity and indicator lists its files and the report statements that cite them.",
  },
  {
    key: "readiness",
    title: "Readiness depends on the stage",
    stepId: "compliance",
    body:
      "While you are drafting, readiness counts data, evidence, checklist and clean sections; approval is only counted once the report goes to review. " +
      "The “Top things to do” list shows the biggest gaps first, each with a button.",
  },
  {
    key: "flags",
    title: "“Needs fixing” is not the same as “we could not confirm”",
    stepId: "report-editor",
    body:
      "Figures that disagree with your verified data are marked “Needs fixing” and block approval. Interpretive statements our checker could not tie to a source are grouped separately: " +
      "read them, then accept a section’s statements with one explained decision.",
  },
];

/** The rule shown with a tour step, if any. */
export function ruleForStep(stepId: string): WorkflowRule | undefined {
  return WORKFLOW_RULES.find((r) => r.stepId === stepId);
}
