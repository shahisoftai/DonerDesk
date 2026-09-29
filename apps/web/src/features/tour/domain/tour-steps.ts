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
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "dashboard-demo-project",
    route: "/projects/{projectId}",
    targetSelector: '[data-tour-id="demo-project-card"]',
    title: "Your sample project",
    body:
      "This is a self-contained demo project — safe to explore, edit, or delete. It never counts " +
      "against your plan limits. We'll walk through it end to end.",
  },
  {
    id: "project-setup",
    route: "/projects/{projectId}/setup",
    targetSelector: '[data-tour-id="project-setup-checklist"]',
    title: "Project setup checklist",
    body:
      "Every project tracks what's needed before it's reporting-ready: a donor template, a logframe " +
      "with indicators, and a reporting profile.",
  },
  {
    id: "donor-template",
    route: "/projects/{projectId}/templates",
    targetSelector: '[data-tour-id="donor-template-review"]',
    title: "Donor template",
    body:
      "DonorDesk extracts your donor's report structure automatically. Review and approve each " +
      "section here — this becomes the skeleton of every report you generate.",
  },
  {
    id: "logframe-indicators",
    route: "/projects/{projectId}/logframe",
    targetSelector: '[data-tour-id="logframe-indicator-list"]',
    title: "Logframe and indicators",
    body: "Define what success looks like: goals, outcomes, outputs, and the indicators that measure them.",
  },
  {
    id: "evidence",
    route: "/projects/{projectId}/evidence",
    targetSelector: '[data-tour-id="evidence-upload"]',
    title: "Evidence library",
    body: "Upload photos, receipts, and documents. DonorDesk tags and links them to your indicators automatically.",
  },
  {
    id: "reporting-period",
    route: "/projects/{projectId}/reports",
    targetSelector: '[data-tour-id="reporting-period-list"]',
    title: "Reporting periods",
    body: "Once a project is ready, open a reporting period to start entering data and generating a report.",
  },
  {
    id: "ai-draft",
    route: "/projects/{projectId}/reports/{periodId}",
    targetSelector: '[data-tour-id="generate-ai-draft"]',
    title: "AI-assisted draft",
    body: "Generate a first draft from your project data. Every number is grounded in what you've entered — never invented.",
  },
  {
    id: "report-editor",
    route: "/projects/{projectId}/reports/{periodId}",
    targetSelector: '[data-tour-id="report-editor"]',
    title: "Review and refine",
    body: "Edit the draft, resolve flagged claims, and exclude anything that doesn't apply before it goes to export.",
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
    body: "Export a watermarked internal copy any time, or a final donor-ready submission once the report is approved.",
  },
];

export function tourStepIds(): string[] {
  return TOUR_STEPS.map((s) => s.id);
}
