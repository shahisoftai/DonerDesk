import { TOUR_STEPS, type TourStep } from "./tour-steps.ts";

/**
 * Steps of the public /tour page (marketing, no signup). The in-app Academy tour needs a
 * `data-tour-id` on a real element for every step; the public tour only needs a screenshot, so it
 * can show more of the product. The Academy steps keep their copy (one source) and the extra steps
 * are slotted into the order a team meets them. Screenshots: `scripts/capture-tour.mjs`.
 */
const EXTRA: Record<string, TourStep> = {
  "activity-capture": {
    id: "activity-capture", route: "/projects/{projectId}/activities/new", targetSelector: "",
    title: "Record an activity in a minute",
    body: "Field officers type or dictate what happened. DonorDesk fills in the date, place and people it finds in the words, works out the reporting period, and never invents a detail. It works offline too.",
  },
  "indicator-entry": {
    id: "indicator-entry", route: "/projects/{projectId}/reports/{periodId}/indicators", targetSelector: "",
    title: "Enter results in one grid",
    body: "Record the period's indicator values like a spreadsheet, with last period's value and the running total beside each box. Attach proof where you type the number.",
  },
  "closing-report": {
    id: "closing-report", route: "/projects/{projectId}/reports/closing", targetSelector: "",
    title: "Close the project with confidence",
    body: "A step-by-step plan for the final report: what is missing, what is ready, and who needs to sign off.",
  },
  "team": {
    id: "team", route: "/projects/{projectId}/team", targetSelector: "",
    title: "The right people, the right access",
    body: "Invite colleagues, partners and viewers. Roles decide who can write, review, approve and export.",
  },
  "plan-timeline": {
    id: "plan-timeline", route: "/projects/{projectId}/activities", targetSelector: "",
    title: "Plan the work on a timeline",
    body: "Plan activities ahead as a list or a Gantt-style timeline. Late items are flagged on their own when their date passes, and you can move them by dragging. Each completed activity links back to the plan.",
  },
  "data-center": {
    id: "data-center", route: "/projects/{projectId}/data", targetSelector: "",
    title: "Every number on one sheet",
    body: "The Data Center puts every indicator, period, target and recorded value in one table. Import a spreadsheet, export it, or chart any measure. A gap shows as Not measured, never as zero.",
  },
  "infographics": {
    id: "infographics", route: "/projects/{projectId}/infographics", targetSelector: "",
    title: "Infographics for donors and the public",
    body: "Design a one-page infographic from your verified results in English, French, Spanish or Arabic. Export it as PNG, PDF or SVG, or share a link that expires.",
  },
  "my-work": {
    id: "my-work", route: "/my-work", targetSelector: "",
    title: "Your work, by when it is due",
    body: "Everything that is yours in one list: planned activities, requests from colleagues, report deadlines and indicator values that are due.",
  },
  "portfolio": {
    id: "portfolio", route: "/portfolio", targetSelector: "",
    title: "Every project at a glance",
    body: "For organisations with several projects. See delivery, problems and risks, and the next report for each live project, most pressing first.",
  },
};

const ORDER = [
  "dashboard-demo-project", "project-setup", "logframe-indicators", "donor-template",
  "plan-timeline", "activity-capture", "evidence", "reporting-period", "indicator-entry",
  "data-center", "ai-draft", "report-editor", "compliance", "export",
  "infographics", "closing-report", "team", "my-work", "portfolio",
];

export const PUBLIC_TOUR_STEPS: readonly TourStep[] = ORDER.map((id) => {
  const s = EXTRA[id] ?? TOUR_STEPS.find((t) => t.id === id);
  if (!s) throw new Error(`public tour: unknown step ${id}`);
  return s;
});
