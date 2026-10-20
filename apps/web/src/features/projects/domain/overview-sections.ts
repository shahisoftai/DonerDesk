import type { Capability, Role } from "@/lib/shared/capabilities";

/**
 * Which parts of the project Overview a person sees, as one table over `Role` plus one table of the
 * capability each part needs. A part a role cannot use is not rendered — hidden, never disabled.
 *
 * Pure: no React, no fetch, no dates of its own. The facts of the project (a plan exists, planning is
 * shown, a period exists, the project is in its final year) decide the rest, so a project without a
 * plan looks exactly as it did before.
 */
export type OverviewSection =
  | "NEEDS_YOU"
  | "PULSE"
  | "CALENDAR"
  | "REPORTING"
  | "DELIVERY"
  | "RESULTS"
  | "TEAM"
  | "RISKS"
  | "CLOSEOUT"
  | "SETUP";

/** The order the parts are shown in. One list, so a new part is added in one place. */
export const OVERVIEW_SECTION_ORDER: readonly OverviewSection[] = [
  "NEEDS_YOU",
  "PULSE",
  "CALENDAR",
  "REPORTING",
  "DELIVERY",
  "RESULTS",
  "TEAM",
  "RISKS",
  "CLOSEOUT",
  "SETUP",
];

const ALL: readonly OverviewSection[] = OVERVIEW_SECTION_ORDER;

/** What the person may see, by role. A test pins that every role has a row. */
export const OVERVIEW_ROLE_SECTIONS: Readonly<Record<Role, readonly OverviewSection[]>> = {
  ADMIN: ALL,
  PROJECT_MANAGER: ALL,
  ME_OFFICER: ["NEEDS_YOU", "PULSE", "CALENDAR", "REPORTING", "DELIVERY", "RESULTS", "TEAM", "RISKS", "CLOSEOUT", "SETUP"],
  GRANTS_OFFICER: ["NEEDS_YOU", "PULSE", "CALENDAR", "REPORTING", "RESULTS", "RISKS", "CLOSEOUT", "SETUP"],
  COMPLIANCE_OFFICER: ["NEEDS_YOU", "PULSE", "CALENDAR", "REPORTING", "RESULTS", "RISKS", "CLOSEOUT", "SETUP"],
  FIELD_OFFICER: ["NEEDS_YOU", "PULSE", "CALENDAR", "DELIVERY", "RISKS"],
  VIEWER: ["PULSE", "REPORTING", "RESULTS", "SETUP"],
};

/** The capability a part needs. `null` means the part is decided by the role and the project's facts. */
export const SECTION_CAPABILITY: Readonly<Record<OverviewSection, Capability | null>> = {
  NEEDS_YOU: null,
  PULSE: null,
  CALENDAR: null,
  REPORTING: null,
  DELIVERY: null,
  RESULTS: null,
  TEAM: "team.view-work",
  RISKS: null,
  CLOSEOUT: "project.edit",
  SETUP: null,
};

/** What is true about the project itself, so a part can stay away when it would say nothing. */
export interface OverviewFacts {
  /** The project has at least one reporting period. */
  hasPeriods: boolean;
  /** The project has planned activities. */
  hasPlan: boolean;
  /** Work planning is shown for this project. */
  planningVisible: boolean;
  /** There is a risk to show, or the person may raise one. */
  hasRisks: boolean;
  /** The project is in its final year (closing is within six months). */
  finalYear: boolean;
}

/** The parts whose own facts make them meaningless. */
function fitsTheProject(section: OverviewSection, facts: OverviewFacts): boolean {
  switch (section) {
    case "REPORTING":
      return facts.hasPeriods;
    case "DELIVERY":
      return facts.hasPlan && facts.planningVisible;
    case "RISKS":
      return facts.hasRisks;
    case "CLOSEOUT":
      return facts.finalYear;
    case "NEEDS_YOU":
    case "PULSE":
    case "CALENDAR":
    case "RESULTS":
    case "TEAM":
    case "SETUP":
      return true;
  }
}

/**
 * The parts this person gets: what the role allows, what the capabilities allow, and what the project
 * has. Adding a role is a new row; adding a part is a new key in both tables.
 */
export function sectionsFor(
  role: string | null | undefined,
  capabilities: ReadonlySet<Capability>,
  facts: OverviewFacts,
): OverviewSection[] {
  const byRole = OVERVIEW_ROLE_SECTIONS[(role ?? "VIEWER") as Role] ?? OVERVIEW_ROLE_SECTIONS.VIEWER;
  return OVERVIEW_SECTION_ORDER.filter((section) => {
    if (!byRole.includes(section)) return false;
    const needed = SECTION_CAPABILITY[section];
    if (needed && !capabilities.has(needed)) return false;
    return fitsTheProject(section, facts);
  });
}

/** The part names, for copy and for tests. */
export const OVERVIEW_SECTION_LABEL: Readonly<Record<OverviewSection, string>> = {
  NEEDS_YOU: "Needs you",
  PULSE: "Pulse",
  CALENDAR: "Calendar",
  REPORTING: "Reporting",
  DELIVERY: "Delivery",
  RESULTS: "Results and money",
  TEAM: "Team",
  RISKS: "Risks and decisions",
  CLOSEOUT: "Close-out",
  SETUP: "Setup",
};
