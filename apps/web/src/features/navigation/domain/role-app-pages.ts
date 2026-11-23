import type { Role } from "@/lib/shared/capabilities";

/**
 * Which top-level pages of the app a role may open at all (Phase 63b); the project's own pages are `role-project-pages`. A role with no row is
 * not restricted, so every other role behaves as before, and a new restricted role is a row, never a branch. A path covers its detail
 * pages; `deny` wins over `allow` (a project can be opened but not started). Anything else answers "not found", wherever the link came from
 * (including the redirects `/charts`, `/maps`, `/infographics` into the Visual Studio).
 */
export interface AppPageRule { allow: readonly string[]; deny?: readonly string[] }

export const ROLE_REACHABLE_APP_PAGES: Readonly<Partial<Record<Role, AppPageRule>>> = {
  FIELD_OFFICER: {
    allow: ["/dashboard", "/inbox", "/projects", "/more", "/waiting", "/field", "/help", "/settings/security", "/logout", "/onboarding"],
    deny: ["/projects/new"],
  },
};

const clean = (path: string): string => (path.split("?", 1)[0] ?? "").replace(/\/+$/, "") || "/";
const covers = (rule: string, path: string): boolean => path === rule || path.startsWith(`${rule}/`);

/** True when the role may open this path. An unrestricted role may open any; a restricted role with no path known is refused (fail closed: a route missing from the middleware list must not open a screen). */
export function canReachAppPage(role: string | null | undefined, rawPath: string): boolean {
  const rule = role ? ROLE_REACHABLE_APP_PAGES[role as Role] : undefined;
  if (!rule) return true;
  if (!rawPath) return false;
  const path = clean(rawPath);
  if (rule.deny?.some((d) => covers(d, path))) return false;
  return path === "/" || rule.allow.some((a) => covers(a, path));
}
