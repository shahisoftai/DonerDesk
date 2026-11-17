import { ruleForStep } from "./workflow-rules.ts";

/**
 * DonorDesk Academy guided tour (Feature 22). Steps mirror the real reporting
 * workflow in the order a user naturally hits it (see
 * `memorybank/Features/22-DonorDesk-Academy.md` §4), anchored to real
 * `data-tour-id` attributes placed on the actual UI elements — never a
 * simplified or fictional mockup of the product.
 *
 * `targetSelector` is a CSS selector matched against `[data-tour-id="..."]`.
 * A step whose target isn't present on the current route (e.g. the user
 * navigated away, or lacks permission to see it) is skipped automatically by
 * the overlay rather than shown floating in space.
 */
export type TourStep = {
  id: string;
  route: string;
  targetSelector: string;
  title: string;
  body: string;
  optional?: boolean;
  /** A rule worth knowing at this step, from `workflow-rules.ts` (single source of the wording). */
  rule?: { title: string; body: string };
};

const BASE_STEPS: readonly TourStep[] = [
  {
    id: "dashboard-demo-project",
    route: "/projects/{projectId}",
    targetSelector: '[data-tour-id="demo-project-card"]',
    title: "Your sample project",
    body:
      "This is a self-contained sample project: safe to explore, edit or delete. It never counts " +
      "against your plan limits. We'll walk through it from setup to export.",
  },
  {
    id: "project-setup",
    route: "/projects/{projectId}/setup",
    targetSelector: '[data-tour-id="project-setup-checklist"]',
    title: "Setup: what a project needs",
    body:
      "Setup (under Settings) lists what a project needs before it can report: a results framework with indicators, " +
      "a donor template, a reporting profile and a team. New projects start from the setup wizard, which reads your own documents.",
  },
  {
    id: "logframe-indicators",
    route: "/projects/{projectId}/logframe",
    targetSelector: '[data-tour-id="logframe-indicator-list"]',
    title: "Results framework and indicators",
    body: "Goals, outcomes, outputs and activities with the indicators that measure them. Read it as a results framework or a logframe, in your donor's own words.",
  },
  {
    id: "work-plan",
    route: "/projects/{projectId}/activities",
    targetSelector: '[data-tour-id="work-plan"]',
    title: "Work plan",
    body: "Plan the work as a list, a timeline or a map, with leads, places and dates. Late items flag themselves and completed activities link back to the plan.",
    optional: true,
  },
  {
    id: "donor-template",
    route: "/projects/{projectId}/templates",
    targetSelector: '[data-tour-id="donor-template-review"]',
    title: "Donor template",
    body:
      "DonorDesk extracts your donor's report structure for you to review. Approve each " +
      "section here: this becomes the skeleton of every report you generate.",
  },
  {
    id: "reporting-period",
    route: "/projects/{projectId}/reports",
    targetSelector: '[data-tour-id="reporting-period-list"]',
    title: "Reporting periods",
    body: "Open a reporting period to enter its figures, tell the story and generate its report. Each period moves through Inputs, Story, Draft and Review.",
  },
  {
    id: "entry-sheet",
    route: "/projects/{projectId}/reports/{periodId}/inputs?tab=indicators",
    targetSelector: '[data-tour-id="entry-sheet"]',
    title: "Enter the period's figures",
    body: "Type or paste from Excel into one grid, with the last period's value beside each box. A reviewer verifies each value; a verified value is locked.",
  },
  {
    id: "evidence",
    route: "/projects/{projectId}/evidence",
    targetSelector: '[data-tour-id="evidence-upload"]',
    title: "Evidence library",
    body: "Upload photos, receipts and documents against an activity or an indicator value, so reports can cite them as proof.",
  },
  {
    id: "data-center",
    route: "/projects/{projectId}/data",
    targetSelector: '[data-tour-id="data-center"]',
    title: "Data Center",
    body: "Every indicator, period, target and value on one sheet. Import, export or chart any measure; a gap shows as Not measured, never as zero.",
    optional: true,
  },
  {
    id: "ai-draft",
    route: "/projects/{projectId}/reports/{periodId}",
    targetSelector: '[data-tour-id="generate-ai-draft"]',
    title: "AI-assisted draft",
    body: "Generate a first draft from your verified data. Every number is checked against what you entered, so a figure that is not in your inputs is rejected.",
  },
  {
    id: "report-editor",
    route: "/projects/{projectId}/reports/{periodId}",
    targetSelector: '[data-tour-id="report-editor"]',
    title: "Review and refine",
    body: "Edit the draft, see the source of each statement, resolve the claims that need a decision and leave out what does not apply before it goes to export.",
  },
  {
    id: "compliance",
    route: "/projects/{projectId}/compliance",
    targetSelector: '[data-tour-id="compliance-checklist"]',
    title: "Compliance checklist",
    body: "DonorDesk flags missing evidence or unanswered donor questions before you submit.",
    optional: true,
  },
  {
    id: "export",
    route: "/projects/{projectId}/reports/{periodId}/export",
    targetSelector: '[data-tour-id="export-report"]',
    title: "Export",
    body: "Export a watermarked internal copy any time, or a sealed donor submission once the report is approved.",
  },
];

/** Attaches each step's rule (if any) from the shared rules module. */
function withRules(steps: readonly TourStep[]): readonly TourStep[] {
  return steps.map((s) => {
    const rule = ruleForStep(s.id);
    return rule ? { ...s, rule: { title: rule.title, body: rule.body } } : s;
  });
}

export const TOUR_STEPS: readonly TourStep[] = withRules(BASE_STEPS);

export function tourStepIds(): string[] {
  return TOUR_STEPS.map((s) => s.id);
}
