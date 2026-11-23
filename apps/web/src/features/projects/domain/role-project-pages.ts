import type { Role } from "@/lib/shared/capabilities";
import type { ProjectTab } from "./project-tabs";

/**
 * Which pages of a project a role may open at all (Phase 63). Different from `ROLE_PROJECT_TABS`, which only decides what sits in the bar:
 * a role listed here reaches nothing else, not through "More", the command palette or a typed address. A role with no row is not
 * restricted, so the other roles behave exactly as before and a new restricted role is a row, never a branch. Paths are under
 * `/projects/<id>`; a path also covers its detail pages (`/activities` covers `/activities/<id>`).
 */
export const ROLE_REACHABLE_PAGES: Readonly<Partial<Record<Role, readonly string[]>>> = {
  // What a field officer's work needs and nothing more (Phase 63b): their activities (list and map), the forms to fill in, and the page that
  // takes a photo or file. The project's front page is not theirs: it sends them to their forms (see `ROLE_LANDING`).
  FIELD_OFFICER: ["/activities", "/forms", "/evidence/new"],
};

/** Where a restricted role lands when it opens a project: its forms when the project has any, else its first page. A role with no row opens the Overview. */
export const ROLE_LANDING: Readonly<Partial<Record<Role, { withForms: string; otherwise: string }>>> = {
  FIELD_OFFICER: { withForms: "/forms", otherwise: "/activities" },
};

export function landingPageFor(role: string | null | undefined, hasForms: boolean): string | null {
  const row = role ? ROLE_LANDING[role as Role] : undefined;
  return row ? (hasForms ? row.withForms : row.otherwise) : null;
}

const trim = (path: string): string => path.replace(/\/+$/, "");

export function isRestrictedRole(role: string | null | undefined): boolean {
  return !!role && role in ROLE_REACHABLE_PAGES;
}

/** True when the role may open this path under the project. An unrestricted role may open every page. */
export function canReachProjectPage(role: string | null | undefined, subPath: string): boolean {
  const allowed = role ? ROLE_REACHABLE_PAGES[role as Role] : undefined;
  if (!allowed) return true;
  const p = trim(subPath);
  return allowed.some((a) => (a === "" ? p === "" : p === a || p.startsWith(`${a}/`)));
}

/** The tabs a restricted role can open anything in; every tab for an unrestricted role. */
export function tabsReachableBy(role: string | null | undefined, tabs: readonly ProjectTab[]): ProjectTab[] {
  return tabs.filter((t) => t.pages.some((pg) => canReachProjectPage(role, pg.path)));
}
