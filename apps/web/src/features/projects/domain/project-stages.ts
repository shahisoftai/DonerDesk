/**
 * The project's navigation (Phase 65): the project's life as stages, one table. A stage holds the pages for one job; the layout, the
 * breadcrumbs and the command palette read it. A page that is rarely used (`more`, or `onlyWhen` a fact the project lacks) sits under the
 * stage's "More" menu so it stays one click away but never crowds the bar. Pure: no React.
 *
 * Home > Plan > Collect > Review > Report > Finance, then Settings (shown as the gear). Never branch on a stage or page name elsewhere:
 * a new page is a row here (and in `memorybank/imp/phase65-ledger.md`, which `project-ledger.test.mts` enforces).
 */
export type ProjectFact = "DATASETS" | "FORMS";

export interface ProjectSubPage {
  /** English label; translated through `uiLabel`. */
  label: string;
  /** Path under `/projects/<id>`; "" is the project's own page. */
  path: string;
  /** Other paths that belong to this page (its detail pages). */
  also?: readonly string[];
  /** Shown in the bar only when the project has this; otherwise under "More". */
  onlyWhen?: ProjectFact;
  /** Always under "More" (rare tools). */
  more?: boolean;
  /** Shown only with one of these capabilities. */
  needs?: readonly string[];
}

export interface ProjectStage { key: ProjectStageKey; label: string; pages: readonly ProjectSubPage[] }

export const STAGE_KEYS = ["home", "plan", "collect", "review", "report", "finance", "settings"] as const;
export type ProjectStageKey = (typeof STAGE_KEYS)[number];

export const PROJECT_STAGES: readonly ProjectStage[] = [
  { key: "home", label: "Home", pages: [{ label: "Home", path: "" }] },
  {
    key: "plan", label: "Plan", pages: [
      { label: "Results framework", path: "/logframe", also: ["/indicators"] },
      { label: "Work plan", path: "/activities/plan" },
      { label: "Places", path: "/places" },
      { label: "Reporting periods", path: "/periods" },
      { label: "Plan changes", path: "/adaptations", more: true },
    ],
  },
  {
    key: "collect", label: "Collect", pages: [
      { label: "Add data", path: "/collect" },
      { label: "Activities done", path: "/activities" },
      { label: "Files and evidence", path: "/evidence" },
      { label: "Forms", path: "/forms", onlyWhen: "FORMS" },
      { label: "Data files", path: "/datasets", onlyWhen: "DATASETS" },
      { label: "People reached", path: "/beneficiaries", more: true },
      { label: "Enter data", path: "/enter", needs: ["indicator.update"], more: true },
      { label: "Import", path: "/import", more: true },
    ],
  },
  {
    key: "review", label: "Review", pages: [
      { label: "To review", path: "/review" },
      { label: "Data Center", path: "/data" },
    ],
  },
  {
    key: "report", label: "Report", pages: [
      { label: "Reports", path: "/reports" },
      { label: "Donor templates", path: "/templates" },
      { label: "Donor rules", path: "/compliance" },
      { label: "Visuals", path: "/visuals", more: true },
      { label: "Management report", path: "/management-report", more: true },
      { label: "Tables", path: "/report-builder", more: true },
      { label: "Ask DonorDesk", path: "/ask", more: true },
    ],
  },
  { key: "finance", label: "Finance", pages: [{ label: "Finance", path: "/finance" }] },
  {
    key: "settings", label: "Settings", pages: [
      { label: "Setup checklist", path: "/setup", also: ["/setup/profile"] },
      { label: "Project settings", path: "/settings" },
      { label: "Team", path: "/team" },
    ],
  },
];

const pathOf = (projectPath: string) => projectPath.replace(/\/+$/, "");

/** Where a page sits: its stage and sub-page, by the longest matching path (the project root matches only itself). */
export function locateProjectPage(subPath: string): { tab: ProjectStage; page: ProjectSubPage } {
  const p = pathOf(subPath);
  let best: { tab: ProjectStage; page: ProjectSubPage; len: number } | null = null;
  for (const tab of PROJECT_STAGES) {
    for (const page of tab.pages) {
      for (const candidate of [page.path, ...(page.also ?? [])]) {
        const hit = candidate === "" ? p === "" : p === candidate || p.startsWith(`${candidate}/`);
        if (hit && (!best || candidate.length > best.len)) best = { tab, page, len: candidate.length };
      }
    }
  }
  return best ?? { tab: PROJECT_STAGES[0]!, page: PROJECT_STAGES[0]!.pages[0]! };
}

export interface SubNavView { shown: ProjectSubPage[]; more: ProjectSubPage[] }

/** A stage's pages split into the bar and its "More" menu; the page you are on is always in the bar. */
export function subNavFor(tab: ProjectStage, input: { facts: ReadonlySet<ProjectFact>; capabilities: ReadonlySet<string>; current: ProjectSubPage; /** Pages the role may open at all (see `role-project-pages`); absent = every page. */ reachable?: (path: string) => boolean }): SubNavView {
  const allowed = tab.pages.filter((p) => (!p.needs || p.needs.some((c) => input.capabilities.has(c))) && (input.reachable?.(p.path) ?? true));
  const folded = (p: ProjectSubPage) => p !== input.current && (p.more || (p.onlyWhen !== undefined && !input.facts.has(p.onlyWhen)));
  return { shown: allowed.filter((p) => !folded(p)), more: allowed.filter(folded) };
}

/** Breadcrumbs for a project page: Projects › project › stage › page (the stage is left out when it has one page or is the page's first). */
export function projectCrumbs(projectId: string, projectTitle: string, subPath: string): Array<{ href?: string; label: string }> {
  const { tab, page } = locateProjectPage(subPath);
  const base = `/projects/${projectId}`;
  const crumbs: Array<{ href?: string; label: string }> = [{ href: "/projects", label: "Projects" }, { href: base, label: projectTitle }];
  if (tab.key === "home") return crumbs;
  if (tab.pages.length > 1 && tab.pages[0]!.label !== page.label) crumbs.push({ href: base + tab.pages[0]!.path, label: tab.label });
  crumbs.push({ href: base + page.path, label: page.label });
  if (pathOf(subPath) !== page.path && !(page.also ?? []).includes(pathOf(subPath))) crumbs.push({ label: "Details" });
  return crumbs;
}
