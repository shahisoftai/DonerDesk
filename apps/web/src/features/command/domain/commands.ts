import type { Capability } from "@/lib/shared/capabilities";

/**
 * The command palette's table (Version 4.000, plan F69). One row per command: where it goes or what it does, who may use it,
 * and the words it answers to. A command a person's capabilities cannot use is never offered (the same rule as the buttons).
 * Actions run the same screens as their buttons (they open the screen or the Record sheet), so every check still applies.
 * Pure: no React, no DOM.
 */
export type CommandGroup = "GO" | "CREATE" | "DO" | "PROJECT";

export type CommandRun =
  | { kind: "HREF"; href: string }
  | { kind: "RECORD" }
  | { kind: "THEME" }
  | { kind: "SHORTCUTS" };

export interface CommandDef {
  id: string;
  label: string;
  group: CommandGroup;
  run: CommandRun;
  keywords?: string;
  /** Offered only with one of these capabilities. */
  needs?: ReadonlyArray<Capability>;
  /** Two-key shortcut shown in the palette and the shortcut sheet ("G H"). */
  shortcut?: string;
}

export const COMMANDS: readonly CommandDef[] = [
  { id: "go.home", label: "Go to Home", group: "GO", run: { kind: "HREF", href: "/dashboard" }, keywords: "dashboard start", shortcut: "G H" },
  { id: "go.inbox", label: "Go to Inbox", group: "GO", run: { kind: "HREF", href: "/inbox" }, keywords: "tasks notifications updates to do", shortcut: "G I" },
  { id: "go.projects", label: "Go to Projects", group: "GO", run: { kind: "HREF", href: "/projects" }, shortcut: "G P" },
  { id: "go.visuals", label: "Go to Dashboards and infographics", group: "GO", run: { kind: "HREF", href: "/visuals" }, keywords: "charts maps canvas", shortcut: "G D" },
  { id: "go.reports", label: "Go to Reports", group: "GO", run: { kind: "HREF", href: "/reports" }, shortcut: "G R" },
  { id: "go.evidence", label: "Go to Evidence", group: "GO", run: { kind: "HREF", href: "/evidence" }, keywords: "files documents photos", shortcut: "G E" },
  { id: "go.portfolio", label: "Go to Portfolio", group: "GO", run: { kind: "HREF", href: "/portfolio" } },
  { id: "go.downloads", label: "Go to Download Center", group: "GO", run: { kind: "HREF", href: "/downloads" }, keywords: "exports" },
  { id: "go.compliance", label: "Go to Compliance", group: "GO", run: { kind: "HREF", href: "/compliance" }, needs: ["checklist.resolve", "checklist.manage", "audit.view"] },
  { id: "go.waiting", label: "Go to Waiting to send", group: "GO", run: { kind: "HREF", href: "/waiting" }, keywords: "offline outbox queue" },
  { id: "go.team", label: "Go to Team", group: "GO", run: { kind: "HREF", href: "/team" }, needs: ["team.manage", "team.invite"] },
  { id: "go.settings", label: "Go to Settings", group: "GO", run: { kind: "HREF", href: "/settings" }, needs: ["settings.view", "org.manage", "audit.view", "project.create"], shortcut: "G S" },
  { id: "go.security", label: "Two-step sign-in and password", group: "GO", run: { kind: "HREF", href: "/settings/security" }, keywords: "mfa security account" },

  { id: "new.project", label: "Create a project", group: "CREATE", run: { kind: "HREF", href: "/projects/new" }, needs: ["project.create"], keywords: "new wizard setup" },
  { id: "new.record", label: "Record a value, activity, file or expense", group: "CREATE", run: { kind: "RECORD" }, needs: ["indicator.update", "activity.create", "evidence.upload", "workplan.update-own"], keywords: "enter data add", shortcut: "R" },
  { id: "new.dashboard", label: "Create a dashboard or infographic", group: "CREATE", run: { kind: "HREF", href: "/visuals/new" }, keywords: "canvas chart" },
  { id: "new.dataset", label: "Bring in a dataset", group: "CREATE", run: { kind: "HREF", href: "/visuals/datasets/new" }, needs: ["org.manage", "project.edit"], keywords: "table spreadsheet upload" },
  { id: "new.invite", label: "Invite a person", group: "CREATE", run: { kind: "HREF", href: "/team?invite=1" }, needs: ["team.invite", "team.manage"], keywords: "add user member" },

  { id: "do.review-values", label: "Review values waiting to be verified", group: "DO", run: { kind: "HREF", href: "/inbox?kind=VALUE_REVIEW" }, needs: ["indicator.verify"], keywords: "verify approve figures" },
  { id: "do.review-activities", label: "Review completed activities", group: "DO", run: { kind: "HREF", href: "/inbox?kind=ACTIVITY_REVIEW" }, needs: ["activity.review"], keywords: "accept" },
  { id: "do.review-evidence", label: "Verify evidence files", group: "DO", run: { kind: "HREF", href: "/inbox?kind=EVIDENCE_REVIEW" }, needs: ["evidence.verify"] },
  { id: "do.approve-reports", label: "Approve reports waiting for you", group: "DO", run: { kind: "HREF", href: "/inbox?kind=REPORT_APPROVAL" }, needs: ["report.approve"], keywords: "sign off" },
  { id: "do.export", label: "Download an exported report", group: "DO", run: { kind: "HREF", href: "/downloads" }, needs: ["export.create"] },
  { id: "do.theme", label: "Switch light or dark mode", group: "DO", run: { kind: "THEME" }, keywords: "dark light appearance" },
  { id: "do.shortcuts", label: "Show keyboard shortcuts", group: "DO", run: { kind: "SHORTCUTS" }, keywords: "help keys", shortcut: "?" },
];

/** Inside a project, the same commands for that project. */
export const PROJECT_COMMANDS: readonly (Omit<CommandDef, "run" | "group"> & { path: string })[] = [
  { id: "p.overview", label: "Project overview", path: "" },
  { id: "p.plan", label: "Work plan", path: "/activities", keywords: "activities timeline" },
  { id: "p.logframe", label: "Results framework and logframe", path: "/logframe", keywords: "indicators outcomes outputs" },
  { id: "p.data", label: "Data Center", path: "/data", keywords: "values sheet charts" },
  { id: "p.enter", label: "Enter data for this project", path: "/enter", needs: ["indicator.update"], keywords: "record values" },
  { id: "p.import", label: "Import a file into this project", path: "/import", needs: ["project.edit", "indicator.update", "activity.create"], keywords: "upload spreadsheet excel csv" },
  { id: "p.evidence", label: "Evidence of this project", path: "/evidence" },
  { id: "p.upload", label: "Upload evidence to this project", path: "/evidence/new", needs: ["evidence.upload"] },
  { id: "p.reports", label: "Reports of this project", path: "/reports" },
  { id: "p.new-report", label: "Start a new report for this project", path: "/reports/new", needs: ["reporting.create"] },
  { id: "p.places", label: "Where we work (places and map)", path: "/places", keywords: "map locations districts" },
  { id: "p.finance", label: "Finance of this project", path: "/finance", keywords: "budget expenses funding" },
  { id: "p.team", label: "Team of this project", path: "/team" },
  { id: "p.map", label: "Map of this project", path: "", keywords: "maps" },
  { id: "p.settings", label: "Project settings", path: "/settings", needs: ["project.edit"] },
];

export interface CommandView { id: string; label: string; group: CommandGroup; run: CommandRun; shortcut?: string; hint?: string }

const allowed = (needs: ReadonlyArray<Capability> | undefined, caps: ReadonlySet<string>) => !needs || needs.some((c) => caps.has(c));

/** The project a page belongs to, read from its address (`/projects/<id>/…`); `new` is not a project. */
export function projectOfPath(pathname: string): string | null {
  const m = /^\/projects\/([^/]+)/.exec(pathname);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]!) : null;
}

/** Every command this person may run here, project commands first when inside a project. */
export function availableCommands(input: { capabilities: ReadonlySet<string>; pathname: string; projectTitle?: string }): CommandView[] {
  const projectId = projectOfPath(input.pathname);
  const project: CommandView[] = projectId
    ? PROJECT_COMMANDS.filter((c) => allowed(c.needs, input.capabilities)).map((c) => ({
        id: c.id,
        label: c.label,
        group: "PROJECT" as const,
        run: { kind: "HREF" as const, href: c.id === "p.map" ? `/visuals/maps/${projectId}` : `/projects/${projectId}${c.path}` },
        ...(input.projectTitle ? { hint: input.projectTitle } : {}),
      }))
    : [];
  const rest = COMMANDS.filter((c) => allowed(c.needs, input.capabilities)).map(({ id, label, group, run, shortcut }) => ({ id, label, group, run, ...(shortcut ? { shortcut } : {}) }));
  return [...project, ...rest];
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** How well a text answers the query: every word must appear; earlier and word-start matches rank higher. 0 = no match. */
export function matchScore(query: string, text: string): number {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const hay = fold(text);
  let score = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) return 0;
    const wordStart = at === 0 || /[\s/(-]/.test(hay[at - 1]!);
    score += (wordStart ? 3 : 1) + Math.max(0, 2 - at / 20);
  }
  return score;
}

/** Commands answering the query, best first; with no query, all of them in table order. */
export function filterCommands(commands: readonly CommandView[], query: string, keywordsOf: (id: string) => string = keywordLookup): CommandView[] {
  if (!query.trim()) return [...commands];
  return commands
    .map((c, i) => ({ c, i, s: matchScore(query, `${c.label} ${keywordsOf(c.id)}`) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

const KEYWORDS = new Map<string, string>([...COMMANDS, ...PROJECT_COMMANDS].map((c) => [c.id, c.keywords ?? ""]));
function keywordLookup(id: string): string { return KEYWORDS.get(id) ?? ""; }

/** Two-key shortcuts ("G H"): the second key after G within a second goes to the command's address. */
export function shortcutTarget(sequence: string, capabilities: ReadonlySet<string>): CommandDef | null {
  return COMMANDS.find((c) => c.shortcut === sequence && c.run.kind === "HREF" && allowed(c.needs, capabilities)) ?? null;
}

export const GROUP_LABEL: Readonly<Record<CommandGroup, string>> = { PROJECT: "This project", GO: "Go to", CREATE: "Create", DO: "Do" };
