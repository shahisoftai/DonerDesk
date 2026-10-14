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
};

const ORDER = [
  "dashboard-demo-project", "project-setup", "logframe-indicators", "donor-template",
  "activity-capture", "evidence", "reporting-period", "indicator-entry",
  "ai-draft", "report-editor", "compliance", "export", "closing-report", "team",
];

export const PUBLIC_TOUR_STEPS: readonly TourStep[] = ORDER.map((id) => {
  const s = EXTRA[id] ?? TOUR_STEPS.find((t) => t.id === id);
  if (!s) throw new Error(`public tour: unknown step ${id}`);
  return s;
});
