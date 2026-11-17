import type { Capability } from "./capabilities";

/**
 * Empty pages in plain words (Phase 59): why the page is empty, and the one thing to do about it. One table: a new empty page is a row. The
 * button is left out (never disabled) when the person lacks the capability it needs, so nobody is invited to do what the server would refuse.
 */
export type EmptyKey = "REPORTS_NONE" | "EVIDENCE_NONE" | "EVIDENCE_FILTERED" | "COMPLIANCE_NONE" | "PROJECT_EVIDENCE_NONE" | "PROJECT_EVIDENCE_FILTERED";

export interface EmptyDef {
  title: string;
  reason: string;
  action?: { label: string; href: (projectId?: string) => string; needs?: Capability };
}

export const EMPTY_STATES: Readonly<Record<EmptyKey, EmptyDef>> = {
  REPORTS_NONE: {
    title: "No reports yet",
    reason: "A report belongs to a reporting period, and none of your projects has one yet.",
    action: { label: "Open projects", href: () => "/projects" },
  },
  EVIDENCE_NONE: {
    title: "No evidence yet",
    reason: "Evidence is uploaded on a project, next to the work it proves.",
    action: { label: "Open projects", href: () => "/projects" },
  },
  EVIDENCE_FILTERED: {
    title: "Nothing matches these filters",
    reason: "There is evidence, but none of it fits the filters you chose.",
    action: { label: "Clear filters", href: () => "/evidence" },
  },
  COMPLIANCE_NONE: {
    title: "No open compliance gaps",
    reason: "Every compliance item you can see is done, or no report has raised one yet.",
    action: { label: "Open reports", href: () => "/reports" },
  },
  PROJECT_EVIDENCE_NONE: {
    title: "No evidence on this project yet",
    reason: "Evidence is the file that proves an activity or a figure; reports cite it.",
    action: { label: "Upload evidence", href: (id) => `/projects/${id}/evidence/new`, needs: "evidence.upload" },
  },
  PROJECT_EVIDENCE_FILTERED: {
    title: "Nothing matches these filters",
    reason: "This project has evidence, but none of it fits the filters you chose.",
    action: { label: "Clear filters", href: (id) => `/projects/${id}/evidence` },
  },
};

export interface EmptyView { title: string; reason: string; action: { label: string; href: string } | null }

export function emptyView(key: EmptyKey, capabilities: ReadonlySet<string>, projectId?: string): EmptyView {
  const def = EMPTY_STATES[key];
  const allowed = def.action && (!def.action.needs || capabilities.has(def.action.needs));
  return { title: def.title, reason: def.reason, action: allowed && def.action ? { label: def.action.label, href: def.action.href(projectId) } : null };
}
