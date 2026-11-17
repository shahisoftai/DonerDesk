/**
 * The public /tour (marketing, no signup), rebuilt in Version 4.01 as six chapters that match the six jobs on /platform
 * (plan, collect, track, see, prove, report). One row per scene: where to capture it, what to spotlight, who it matters to.
 * The words live in `public-tour-copy.ts` (one typed table per language) so this structure never changes for a translation.
 * Pure module: no React, no imports besides types, so it is unit-testable and the capture script can read it.
 *
 * `hook` is a `data-tour-id` that must exist in the app (`public-tour.test.mts` greps for it); the capture script
 * spotlights that element. `route` placeholders are filled by `scripts/capture-tour.mjs` from the demo tenant.
 */
export const TOUR_CHAPTERS = ["plan", "collect", "track", "see", "prove", "report"] as const;
export type TourChapter = (typeof TOUR_CHAPTERS)[number];

export const TOUR_ROLES = ["director", "manager", "me", "field", "grants"] as const;
export type TourRole = (typeof TOUR_ROLES)[number];

export type TourViewport = "desktop" | "phone";

export interface TourScene {
  id: string;
  chapter: TourChapter;
  /** App route with `{projectId}`, `{periodId}` and `{canvasId}` placeholders. */
  route: string;
  /** The `data-tour-id` of the element to spotlight. */
  hook: string;
  viewport: TourViewport;
  /** Which demo person the capture signs in as. */
  as: "manager" | "field";
  /** The roles whose "Show me my part" path includes this scene. */
  roles: readonly TourRole[];
  /** A `#id` on /features that goes deeper. */
  feature: string;
}

export const TOUR_SCENES: readonly TourScene[] = [
  // Plan
  { id: "wizard", chapter: "plan", route: "/projects/new/wizard", hook: "wizard", viewport: "desktop", as: "manager", roles: ["manager", "me", "grants"], feature: "plan" },
  { id: "sector-library", chapter: "plan", route: "/settings/sector-library", hook: "sector-library", viewport: "desktop", as: "manager", roles: ["manager", "me"], feature: "logframe" },
  { id: "framework", chapter: "plan", route: "/projects/{projectId}/logframe", hook: "logframe-indicator-list", viewport: "desktop", as: "manager", roles: ["director", "manager", "me", "grants"], feature: "logframe" },
  { id: "work-plan", chapter: "plan", route: "/projects/{projectId}/activities", hook: "work-plan", viewport: "desktop", as: "manager", roles: ["manager", "field"], feature: "workplan" },
  // Collect
  { id: "record-activity", chapter: "collect", route: "/projects/{projectId}/activities/new", hook: "record-activity", viewport: "desktop", as: "manager", roles: ["manager", "field"], feature: "activities" },
  { id: "forms", chapter: "collect", route: "/projects/{projectId}/forms", hook: "forms", viewport: "desktop", as: "manager", roles: ["manager", "me"], feature: "forms" },
  { id: "field-app", chapter: "collect", route: "/field", hook: "field-app", viewport: "phone", as: "field", roles: ["field"], feature: "field-app" },
  { id: "field-home", chapter: "collect", route: "/dashboard", hook: "field-home", viewport: "phone", as: "field", roles: ["field"], feature: "my-work" },
  // Track
  { id: "entry-sheet", chapter: "track", route: "/projects/{projectId}/reports/{periodId}/inputs?tab=indicators", hook: "entry-sheet", viewport: "desktop", as: "manager", roles: ["manager", "me", "field"], feature: "entry-sheet" },
  { id: "data-center", chapter: "track", route: "/projects/{projectId}/data", hook: "data-center", viewport: "desktop", as: "manager", roles: ["director", "manager", "me", "grants"], feature: "data-center" },
  // See
  { id: "where-we-work", chapter: "see", route: "/where-we-work", hook: "where-we-work", viewport: "desktop", as: "manager", roles: ["director", "manager", "grants"], feature: "places" },
  { id: "chart-studio", chapter: "see", route: "/visuals/charts/{projectId}", hook: "chart-studio", viewport: "desktop", as: "manager", roles: ["me", "manager"], feature: "chart-studio" },
  { id: "dashboard", chapter: "see", route: "/visuals/{canvasId}", hook: "dashboard-canvas", viewport: "desktop", as: "manager", roles: ["director", "manager", "grants"], feature: "dashboards" },
  { id: "dashboard-templates", chapter: "see", route: "/visuals/templates", hook: "dashboard-templates", viewport: "desktop", as: "manager", roles: ["me", "manager"], feature: "sector-dashboards" },
  { id: "portfolio", chapter: "see", route: "/portfolio", hook: "portfolio", viewport: "desktop", as: "manager", roles: ["director", "grants"], feature: "portfolio" },
  // Prove
  { id: "evidence", chapter: "prove", route: "/projects/{projectId}/evidence", hook: "evidence-upload", viewport: "desktop", as: "manager", roles: ["manager", "me", "field"], feature: "evidence" },
  { id: "audit", chapter: "prove", route: "/audit", hook: "audit", viewport: "desktop", as: "manager", roles: ["director", "grants"], feature: "security" },
  { id: "team", chapter: "prove", route: "/projects/{projectId}/team", hook: "team", viewport: "desktop", as: "manager", roles: ["director", "manager"], feature: "team" },
  // Report
  { id: "donor-template", chapter: "report", route: "/projects/{projectId}/templates", hook: "donor-template-review", viewport: "desktop", as: "manager", roles: ["manager", "grants"], feature: "templates" },
  { id: "ai-draft", chapter: "report", route: "/projects/{projectId}/reports/{periodId}", hook: "generate-ai-draft", viewport: "desktop", as: "manager", roles: ["manager", "me", "grants"], feature: "drafting" },
  { id: "report-editor", chapter: "report", route: "/projects/{projectId}/reports/{periodId}", hook: "report-editor", viewport: "desktop", as: "manager", roles: ["manager", "me", "grants"], feature: "editor" },
  { id: "export", chapter: "report", route: "/projects/{projectId}/reports/{periodId}/export", hook: "export-report", viewport: "desktop", as: "manager", roles: ["director", "manager", "grants"], feature: "approval" },
  { id: "closing-report", chapter: "report", route: "/projects/{projectId}/reports/closing", hook: "closing-report", viewport: "desktop", as: "manager", roles: ["manager", "grants"], feature: "reporting" },
  { id: "ask", chapter: "report", route: "/projects/{projectId}/ask", hook: "ask", viewport: "desktop", as: "manager", roles: ["director", "manager", "me"], feature: "ask" },
];

/** The scenes of one chapter, in order. */
export function scenesOf(chapter: TourChapter): TourScene[] {
  return TOUR_SCENES.filter((s) => s.chapter === chapter);
}

/** The scenes on one role's path, in tour order; every role has at least four. */
export function scenesForRole(role: TourRole): TourScene[] {
  return TOUR_SCENES.filter((s) => s.roles.includes(role));
}

/** The scene a `#fragment` names (`#collect` = the chapter's first scene, `#entry-sheet` = that scene). */
export function sceneForHash(hash: string): TourScene | null {
  const key = hash.replace(/^#/, "");
  const chapter = (TOUR_CHAPTERS as readonly string[]).includes(key) ? (key as TourChapter) : null;
  return chapter ? scenesOf(chapter)[0] ?? null : TOUR_SCENES.find((s) => s.id === key) ?? null;
}
