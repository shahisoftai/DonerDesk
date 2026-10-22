import type { Capability, Role } from "@/lib/shared/capabilities";

/**
 * What each role sees in the left navigation and which Home they land on, as two exhaustive tables over `Role`.
 * An entry a person's capabilities cannot use is not shown (hidden, never disabled). `/dashboard` is the one entry
 * point after sign-in; it renders the Home named here, so no role needs its own address.
 */
export type NavKey =
  | "HOME" | "MY_WORK" | "PORTFOLIO" | "PROJECTS" | "REPORTS" | "EVIDENCE" | "COMPLIANCE" | "FUNDING"
  | "DOWNLOADS" | "TEAM" | "SETTINGS";

export interface NavEntry {
  href: string;
  label: string;
  group: string;
  /** Shown only with this capability (any one of them, when several). */
  needs?: ReadonlyArray<Capability>;
}

export const NAV_ENTRIES: Readonly<Record<NavKey, NavEntry>> = {
  HOME: { href: "/dashboard", label: "Home", group: "Overview" },
  MY_WORK: { href: "/my-work", label: "My Work", group: "Overview" },
  PORTFOLIO: { href: "/portfolio", label: "Portfolio", group: "Overview" },
  PROJECTS: { href: "/projects", label: "Projects", group: "Deliver" },
  REPORTS: { href: "/reports", label: "Reports", group: "Report" },
  EVIDENCE: { href: "/evidence", label: "Evidence", group: "Report" },
  COMPLIANCE: { href: "/compliance", label: "Compliance", group: "Report" },
  FUNDING: { href: "/programmes", label: "Programmes and grants", group: "Fund" },
  DOWNLOADS: { href: "/downloads", label: "Download Center", group: "Report" },
  TEAM: { href: "/team", label: "Team", group: "Admin", needs: ["team.manage", "team.invite"] },
  SETTINGS: { href: "/settings", label: "Settings", group: "Admin", needs: ["project.create", "audit.view", "settings.view", "org.manage"] },
};

export type HomeVariant = "DIRECTOR" | "MANAGER" | "FIELD" | "GRANTS" | "COMPLIANCE";

export interface RoleNavigation {
  home: HomeVariant;
  /** In display order; groups appear in the order their first entry does. */
  entries: ReadonlyArray<NavKey>;
}

export const ROLE_NAVIGATION: Readonly<Record<Role, RoleNavigation>> = {
  ADMIN: { home: "DIRECTOR", entries: ["HOME", "MY_WORK", "PORTFOLIO", "PROJECTS", "REPORTS", "EVIDENCE", "COMPLIANCE", "DOWNLOADS", "FUNDING", "TEAM", "SETTINGS"] },
  PROJECT_MANAGER: { home: "MANAGER", entries: ["HOME", "MY_WORK", "PORTFOLIO", "PROJECTS", "REPORTS", "EVIDENCE", "DOWNLOADS", "TEAM", "SETTINGS"] },
  ME_OFFICER: { home: "MANAGER", entries: ["HOME", "MY_WORK", "PORTFOLIO", "PROJECTS", "REPORTS", "EVIDENCE", "DOWNLOADS"] },
  GRANTS_OFFICER: { home: "GRANTS", entries: ["HOME", "MY_WORK", "PORTFOLIO", "PROJECTS", "REPORTS", "DOWNLOADS", "FUNDING", "SETTINGS"] },
  COMPLIANCE_OFFICER: { home: "COMPLIANCE", entries: ["HOME", "MY_WORK", "PROJECTS", "REPORTS", "EVIDENCE", "COMPLIANCE", "DOWNLOADS"] },
  FIELD_OFFICER: { home: "FIELD", entries: ["HOME", "MY_WORK", "PROJECTS", "EVIDENCE"] },
  VIEWER: { home: "DIRECTOR", entries: ["HOME", "PORTFOLIO", "PROJECTS", "REPORTS", "DOWNLOADS"] },
};

export interface NavItemView { href: string; label: string; group: string }

const EXTERNAL_NAV: ReadonlyArray<NavItemView> = [{ href: "/projects", label: "My projects", group: "Overview" }];

function roleOf(role: string | null | undefined): Role {
  return (role && role in ROLE_NAVIGATION ? role : "VIEWER") as Role;
}

export function homeVariantFor(role: string | null | undefined): HomeVariant {
  return ROLE_NAVIGATION[roleOf(role)].home;
}

export function navFor(input: { role: string | null | undefined; capabilities: ReadonlySet<Capability>; external: boolean }): NavItemView[] {
  if (input.external) return [...EXTERNAL_NAV];
  return ROLE_NAVIGATION[roleOf(input.role)].entries
    .map((key) => NAV_ENTRIES[key])
    .filter((e) => !e.needs || e.needs.some((c) => input.capabilities.has(c)))
    .map(({ href, label, group }) => ({ href, label, group }));
}
