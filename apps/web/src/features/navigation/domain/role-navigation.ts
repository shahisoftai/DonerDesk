import type { Capability, Role } from "@/lib/shared/capabilities";

/**
 * What each role sees in the left navigation and which Home they land on, as two exhaustive tables over `Role`.
 * An entry a person's capabilities cannot use is not shown (hidden, never disabled). `/dashboard` is the one entry
 * point after sign-in; it renders the Home named here, so no role needs its own address.
 */
export type NavKey =
  | "HOME" | "INBOX" | "PORTFOLIO" | "PLACES" | "VISUALS" | "PROJECTS" | "REPORTS" | "EVIDENCE" | "COMPLIANCE" | "FUNDING"
  | "DOWNLOADS" | "TEAM" | "SETTINGS";

export interface NavEntry {
  href: string;
  label: string;
  group: string;
  /** Shown only with this capability (any one of them, when several). */
  needs?: ReadonlyArray<Capability>;
}

export const NAV_ENTRIES: Readonly<Record<NavKey, NavEntry>> = {
  HOME: { href: "/dashboard", label: "Home", group: "Work" },
  INBOX: { href: "/inbox", label: "Inbox", group: "Work" },
  PROJECTS: { href: "/projects", label: "Projects", group: "Work" },
  VISUALS: { href: "/visuals", label: "Dashboards and infographics", group: "Work" },
  PORTFOLIO: { href: "/portfolio", label: "Portfolio", group: "Work" },
  // Phase 56: the organisation's map of its work, derived from every project (replaces Settings › Places).
  PLACES: { href: "/where-we-work", label: "Where we work", group: "Work" },
  REPORTS: { href: "/reports", label: "Reports", group: "Report" },
  EVIDENCE: { href: "/evidence", label: "Evidence", group: "Report" },
  COMPLIANCE: { href: "/compliance", label: "Compliance", group: "Report" },
  DOWNLOADS: { href: "/downloads", label: "Download Center", group: "Report" },
  FUNDING: { href: "/programmes", label: "Programmes and grants", group: "Report" },
  TEAM: { href: "/team", label: "Team", group: "Admin", needs: ["team.manage", "team.invite"] },
  SETTINGS: { href: "/settings", label: "Settings", group: "Admin", needs: ["project.create", "audit.view", "settings.view", "org.manage"] },
};

/**
 * Version 4.000 (plan F1): related pages share one sidebar entry and appear as tabs at the top of each other. The first key
 * is the sidebar entry; the others are shown only as tabs. A role sees a tab only when its entries name it.
 */
export const NAV_HUBS: ReadonlyArray<ReadonlyArray<NavKey>> = [
  ["HOME", "PORTFOLIO", "PLACES"],
  ["REPORTS", "EVIDENCE", "COMPLIANCE", "DOWNLOADS"],
];

const TAB_ONLY: ReadonlySet<NavKey> = new Set(NAV_HUBS.flatMap((hub) => hub.slice(1)));

export type HomeVariant = "DIRECTOR" | "MANAGER" | "FIELD" | "GRANTS" | "COMPLIANCE";

export interface RoleNavigation {
  home: HomeVariant;
  /** In display order; groups appear in the order their first entry does. */
  entries: ReadonlyArray<NavKey>;
}

export const ROLE_NAVIGATION: Readonly<Record<Role, RoleNavigation>> = {
  ADMIN: { home: "DIRECTOR", entries: ["HOME", "PORTFOLIO", "PLACES", "INBOX", "PROJECTS", "VISUALS", "REPORTS", "EVIDENCE", "COMPLIANCE", "DOWNLOADS", "FUNDING", "TEAM", "SETTINGS"] },
  PROJECT_MANAGER: { home: "MANAGER", entries: ["HOME", "PORTFOLIO", "PLACES", "INBOX", "PROJECTS", "VISUALS", "REPORTS", "EVIDENCE", "DOWNLOADS", "TEAM", "SETTINGS"] },
  ME_OFFICER: { home: "MANAGER", entries: ["HOME", "PORTFOLIO", "PLACES", "INBOX", "PROJECTS", "VISUALS", "REPORTS", "EVIDENCE", "DOWNLOADS"] },
  GRANTS_OFFICER: { home: "GRANTS", entries: ["HOME", "PORTFOLIO", "PLACES", "INBOX", "PROJECTS", "VISUALS", "REPORTS", "DOWNLOADS", "FUNDING", "SETTINGS"] },
  COMPLIANCE_OFFICER: { home: "COMPLIANCE", entries: ["HOME", "INBOX", "PROJECTS", "REPORTS", "EVIDENCE", "COMPLIANCE", "DOWNLOADS"] },
  // Field officers keep a short list (plan F36): Home, Inbox, Projects and Evidence, nothing administrative.
  FIELD_OFFICER: { home: "FIELD", entries: ["HOME", "INBOX", "PROJECTS", "EVIDENCE"] },
  VIEWER: { home: "DIRECTOR", entries: ["HOME", "PORTFOLIO", "PLACES", "PROJECTS", "VISUALS", "REPORTS", "DOWNLOADS"] },
};

export interface NavItemView { href: string; label: string; group: string }

const EXTERNAL_NAV: ReadonlyArray<NavItemView> = [{ href: "/dashboard", label: "Home", group: "Overview" }, { href: "/projects", label: "My projects", group: "Overview" }, { href: "/settings/security", label: "Security", group: "Account" }];

function roleOf(role: string | null | undefined): Role {
  return (role && role in ROLE_NAVIGATION ? role : "VIEWER") as Role;
}

export function homeVariantFor(role: string | null | undefined): HomeVariant {
  return ROLE_NAVIGATION[roleOf(role)].home;
}

function visibleKeys(input: { role: string | null | undefined; capabilities: ReadonlySet<Capability> }): NavKey[] {
  return ROLE_NAVIGATION[roleOf(input.role)].entries.filter((key) => {
    const e = NAV_ENTRIES[key];
    return !e.needs || e.needs.some((c) => input.capabilities.has(c));
  });
}

/**
 * The sidebar. A page that is a tab of a hub is folded into the hub's entry, unless the role cannot see the hub's own page,
 * in which case it keeps its own entry (a field officer's Evidence).
 */
export function navFor(input: { role: string | null | undefined; capabilities: ReadonlySet<Capability>; external: boolean }): NavItemView[] {
  if (input.external) return [...EXTERNAL_NAV];
  const keys = visibleKeys(input);
  const shown = new Set(keys);
  return keys
    .filter((key) => !TAB_ONLY.has(key) || !NAV_HUBS.some((hub) => hub.includes(key) && shown.has(hub[0]!)))
    .map((key) => NAV_ENTRIES[key])
    .map(({ href, label, group }) => ({ href, label, group }));
}

export interface HubTabView { href: string; label: string }

/** The tabs a role sees on each hub (only hubs with two or more visible pages), keyed by every address in the hub. */
export function hubTabsFor(input: { role: string | null | undefined; capabilities: ReadonlySet<Capability>; external: boolean }): HubTabView[][] {
  if (input.external) return [];
  const shown = new Set(visibleKeys(input));
  return NAV_HUBS
    .filter((hub) => shown.has(hub[0]!))
    .map((hub) => hub.filter((k) => shown.has(k)).map((k) => ({ href: NAV_ENTRIES[k].href, label: NAV_ENTRIES[k].label })))
    .filter((tabs) => tabs.length > 1);
}

/** The sidebar entry a page belongs to (a hub tab lights its hub). */
export function sidebarHrefFor(pathname: string): string | null {
  for (const hub of NAV_HUBS) {
    for (const key of hub) {
      const href = NAV_ENTRIES[key].href;
      if (pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))) return NAV_ENTRIES[hub[0]!].href;
    }
  }
  return null;
}
