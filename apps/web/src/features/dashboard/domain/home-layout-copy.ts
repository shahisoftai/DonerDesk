import type { LayoutPanel, PanelSpan } from "./home-layout.ts";

/** What each arranged panel is called in the arrange list. Exhaustive over the layout's panels. */
export const PANEL_LABEL: Readonly<Record<LayoutPanel, string>> = {
  HEADLINES: "Headline figures",
  FUNDING: "Funding",
  MAP: "Where we work",
  BREAKDOWNS: "Projects by …",
  PROJECT_HEALTH: "Project health",
  UPCOMING_REPORTS: "Upcoming reports",
  PIPELINE: "Report pipeline",
  RESULTS: "Results against target",
  RISKS: "Risks and problems",
  DELIVERY: "Delivery this week",
  DATA_EVIDENCE: "Data and evidence",
  NOTIFICATIONS: "Notifications",
  YOUR_WORK: "Your work",
  GRANTS: "Grants",
  QUICK_LINKS: "Quick links",
};

export const SPAN_LABEL: Readonly<Record<PanelSpan, string>> = { 4: "Narrow", 6: "Half", 8: "Wide", 12: "Full width" };

export const LAYOUT_COPY = {
  open: "Arrange Home",
  title: "Arrange Home",
  intro: "Choose the order and width of the panels, or hide the ones you do not use. Only you see this arrangement. On a phone, panels always stack in this order.",
  show: "Show",
  width: "Width",
  save: "Save arrangement",
  cancel: "Cancel",
  reset: "Back to the default",
  saved: "Your arrangement is saved.",
  unchanged: "Nothing has changed yet.",
  resetFailed: "The default could not be restored. Try again.",
} as const;
