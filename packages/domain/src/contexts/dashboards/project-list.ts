/**
 * A project list on a dashboard (Phase 35, after DevResults' "Project List" tile): the projects the viewer can see, filtered by status and sector, optionally only
 * those they are assigned to. It stores the filter, never the projects: the list is made when the dashboard is opened, for the person opening it, so each viewer
 * sees their own. A share link shows none. Pure.
 */
export const PROJECT_LIST_AFFILIATIONS = ["ALL", "ASSIGNED"] as const;
export type ProjectListAffiliation = (typeof PROJECT_LIST_AFFILIATIONS)[number];
export const PROJECT_LIST_AFFILIATION_LABEL: Readonly<Record<ProjectListAffiliation, string>> = { ALL: "All projects I can see", ASSIGNED: "Projects I am assigned to" };
export const PROJECT_LIST_MAX_ROWS = 50;

export interface ProjectListQuery {
  /** A project status such as ACTIVE; absent = any. */
  status?: string | undefined;
  /** A sector as recorded; absent = any. */
  sector?: string | undefined;
  affiliation: ProjectListAffiliation;
  title?: string | undefined;
}

export interface ProjectListSource { projectId: string; title: string; status: string; sector: string; country: string; donorName: string; managerId?: string | undefined; meOfficerId?: string | undefined; reportingOfficerId?: string | undefined }

export function validateProjectList(q: ProjectListQuery): string | null {
  if (!PROJECT_LIST_AFFILIATIONS.includes(q.affiliation)) return "Choose which projects the list shows.";
  if (q.status !== undefined && q.status.length > 30) return "That status is not valid.";
  if (q.sector !== undefined && q.sector.length > 60) return "That sector is not valid.";
  if (q.title !== undefined && q.title.length > 60) return "A list's name is at most 60 characters.";
  return null;
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const words = (v: string): string => (v === "" ? "Not recorded" : v.toLowerCase().split(/[_\s]+/).map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" "));

/** The table for a viewer: filtered, in title order, capped (and said so when it is). */
export function projectListTable(sources: ReadonlyArray<ProjectListSource>, q: ProjectListQuery, userId: string): { title: string; columns: string[]; rows: string[][]; notes: string[] } {
  const picked = sources
    .filter((p) => (q.status ? same(p.status, q.status) : true) && (q.sector ? same(p.sector, q.sector) : true))
    .filter((p) => q.affiliation === "ALL" || p.managerId === userId || p.meOfficerId === userId || p.reportingOfficerId === userId)
    .sort((a, b) => a.title.localeCompare(b.title));
  const notes: string[] = [];
  if (picked.length > PROJECT_LIST_MAX_ROWS) notes.push(`Showing the first ${PROJECT_LIST_MAX_ROWS} of ${picked.length} projects.`);
  if (picked.length === 0) notes.push("No project matches this list's filters.");
  return {
    title: q.title?.trim() || "Projects",
    columns: ["Project", "Status", "Sector", "Country", "Funder"],
    rows: picked.slice(0, PROJECT_LIST_MAX_ROWS).map((p) => [p.title, words(p.status), words(p.sector), p.country || "Not recorded", p.donorName || "Not recorded"]),
    notes,
  };
}
