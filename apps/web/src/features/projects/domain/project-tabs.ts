/**
 * The project's navigation (Version 4.000, plan F4/F5/F7): seven tabs, each with its own pages. One table; the layout, the
 * breadcrumbs and the command palette read it. A page that is rarely used ("ONLY_WHEN" a fact is true) is folded into the
 * tab's "More" menu until the project uses it, so it stays one click away but never crowds the bar. Pure: no React.
 */
export type ProjectFact = "DATASETS" | "FORMS";

export interface ProjectSubPage {
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

export interface ProjectTab { key: string; label: string; pages: readonly ProjectSubPage[] }

export const PROJECT_TABS: readonly ProjectTab[] = [
  {
    key: "overview", label: "Overview", pages: [
      { label: "Overview", path: "" },
      { label: "Management report", path: "/management-report", more: true },
      { label: "Changes of plan", path: "/adaptations", more: true },
      { label: "People reached", path: "/beneficiaries", more: true },
      { label: "Ask DonorDesk", path: "/ask", more: true },
    ],
  },
  {
    key: "plan", label: "Plan", pages: [
      { label: "Results framework", path: "/logframe", also: ["/indicators"] },
      { label: "Work plan", path: "/activities" },
      { label: "Where we work", path: "/places" },
    ],
  },
  {
    key: "data", label: "Data", pages: [
      { label: "Data Center", path: "/data" },
      { label: "Enter data", path: "/enter", needs: ["indicator.update"] },
      { label: "Import", path: "/import" },
      { label: "Forms", path: "/forms", onlyWhen: "FORMS" },
      { label: "Datasets", path: "/datasets", onlyWhen: "DATASETS" },
      { label: "Data tables", path: "/report-builder", more: true },
      { label: "Charts", path: "/charts", more: true },
      { label: "Maps", path: "/maps", more: true },
    ],
  },
  { key: "evidence", label: "Evidence", pages: [{ label: "Evidence", path: "/evidence" }] },
  {
    key: "reports", label: "Reports", pages: [
      { label: "Reports", path: "/reports" },
      { label: "Donor templates", path: "/templates" },
      { label: "Compliance", path: "/compliance" },
      { label: "Infographics", path: "/infographics", more: true },
    ],
  },
  { key: "finance", label: "Finance", pages: [{ label: "Finance", path: "/finance" }] },
  {
    key: "settings", label: "Settings", pages: [
      { label: "Project settings", path: "/settings" },
      { label: "Team", path: "/team" },
      { label: "Setup", path: "/setup" },
    ],
  },
];

const pathOf = (projectPath: string) => projectPath.replace(/\/+$/, "");

/** Where a page sits: its tab and sub-page, by the longest matching path (the project root matches only itself). */
export function locateProjectPage(subPath: string): { tab: ProjectTab; page: ProjectSubPage } {
  const p = pathOf(subPath);
  let best: { tab: ProjectTab; page: ProjectSubPage; len: number } | null = null;
  for (const tab of PROJECT_TABS) {
    for (const page of tab.pages) {
      for (const candidate of [page.path, ...(page.also ?? [])]) {
        const hit = candidate === "" ? p === "" : p === candidate || p.startsWith(`${candidate}/`);
        if (hit && (!best || candidate.length > best.len)) best = { tab, page, len: candidate.length };
      }
    }
  }
  return best ?? { tab: PROJECT_TABS[0]!, page: PROJECT_TABS[0]!.pages[0]! };
}

export interface SubNavView { shown: ProjectSubPage[]; more: ProjectSubPage[] }

/** A tab's pages split into the bar and its "More" menu; the page you are on is always in the bar. */
export function subNavFor(tab: ProjectTab, input: { facts: ReadonlySet<ProjectFact>; capabilities: ReadonlySet<string>; current: ProjectSubPage }): SubNavView {
  const allowed = tab.pages.filter((p) => !p.needs || p.needs.some((c) => input.capabilities.has(c)));
  const folded = (p: ProjectSubPage) => p !== input.current && (p.more || (p.onlyWhen !== undefined && !input.facts.has(p.onlyWhen)));
  return { shown: allowed.filter((p) => !folded(p)), more: allowed.filter(folded) };
}

/** Breadcrumbs for a project page: Projects › project › tab › page (the tab is left out when it has one page). */
export function projectCrumbs(projectId: string, projectTitle: string, subPath: string): Array<{ href?: string; label: string }> {
  const { tab, page } = locateProjectPage(subPath);
  const base = `/projects/${projectId}`;
  const crumbs: Array<{ href?: string; label: string }> = [{ href: "/projects", label: "Projects" }, { href: base, label: projectTitle }];
  if (tab.key === "overview" && page.path === "") return crumbs;
  if (tab.pages.length > 1 && tab.pages[0]!.label !== page.label) crumbs.push({ href: base + tab.pages[0]!.path, label: tab.label });
  crumbs.push({ href: base + page.path, label: page.label });
  if (pathOf(subPath) !== page.path && !(page.also ?? []).includes(pathOf(subPath))) crumbs.push({ label: "Details" });
  return crumbs;
}
