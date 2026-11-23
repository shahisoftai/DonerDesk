import type { Role } from "@/lib/shared/capabilities";
import type { ProjectTab } from "./project-tabs";
import { isRestrictedRole, tabsReachableBy } from "./role-project-pages.ts";

/**
 * Which of the project's tabs each role sees in the bar (Phase 59). The others sit under "More" and stay one click away; a page is never
 * made unreachable, and the command palette and direct links still open it. One exhaustive table over `Role`: a new role fails to compile
 * until it has a row. The tab you are on is always in the bar.
 */
const ALL = ["overview", "plan", "data", "evidence", "reports", "finance", "settings"] as const;
export type ProjectTabKey = (typeof ALL)[number];

export const ROLE_PROJECT_TABS: Readonly<Record<Role, readonly ProjectTabKey[]>> = {
  ADMIN: ALL,
  PROJECT_MANAGER: ALL,
  ME_OFFICER: ALL,
  GRANTS_OFFICER: ["overview", "plan", "evidence", "reports", "finance"],
  COMPLIANCE_OFFICER: ["overview", "evidence", "reports"],
  FIELD_OFFICER: ["overview", "plan", "data", "evidence"],
  VIEWER: ["overview", "plan", "data", "reports"],
};

export interface TabBar { shown: ProjectTab[]; more: ProjectTab[] }

export function tabsFor(tabs: readonly ProjectTab[], role: string | null | undefined, currentKey: string): TabBar {
  // A restricted role has no "More": a tab it cannot open anything in is not offered at all (Phase 63).
  if (isRestrictedRole(role)) return { shown: tabsReachableBy(role, tabs), more: [] };
  const keys = (ROLE_PROJECT_TABS[(role ?? "VIEWER") as Role] ?? ROLE_PROJECT_TABS.VIEWER) as readonly string[];
  const shown = tabs.filter((t) => keys.includes(t.key) || t.key === currentKey);
  return { shown, more: tabs.filter((t) => !shown.includes(t)) };
}
