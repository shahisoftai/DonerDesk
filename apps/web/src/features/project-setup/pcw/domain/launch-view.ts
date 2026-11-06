import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

/** What a person reads for each kind of entry. Kept in step with the risks context by a test. */
export const RISK_KIND_LABEL = {
  PROBLEM: "It has happened",
  RISK: "It might happen",
  ASSUMPTION: "We are assuming",
  DECISION: "We decided",
  DEPENDENCY: "We depend on someone",
} as const;
export const RISK_KINDS = Object.keys(RISK_KIND_LABEL) as Array<keyof typeof RISK_KIND_LABEL>;
export const SERIOUSNESS = ["HIGH", "MEDIUM", "LOW"] as const;

export const riskKindLabel = (kind: string | null): string => (kind && kind in RISK_KIND_LABEL ? RISK_KIND_LABEL[kind as keyof typeof RISK_KIND_LABEL] : "Kind not set");

/** Assumptions first, then the rest, each group in the order given. */
export function groupedRisks(view: SetupDraftView): { assumptions: SetupDraftView["risks"]; others: SetupDraftView["risks"] } {
  return { assumptions: view.risks.filter((r) => r.value.kind === "ASSUMPTION"), others: view.risks.filter((r) => r.value.kind !== "ASSUMPTION") };
}

/** The sentence for what stops the project starting, or null when nothing does. */
export function blockerSentences(view: SetupDraftView, words: { blocked: (n: number) => string; signedStale: string; signHelp: string }): string[] {
  return view.launch.blockers.flatMap((b) =>
    b.kind === "OPEN_REQUIREMENTS" ? [words.blocked(b.count)] : b.kind === "SIGN_OFF_STALE" ? [words.signedStale] : [words.signHelp],
  );
}

/** "2026-11-02T10:00:00.000Z" -> "2 Nov 2026"; the same in every browser. */
export function signedDay(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "";
}

/** Whether the sign-off on the page is for what the page holds now. */
export const isSignedOffNow = (view: SetupDraftView): boolean => Boolean(view.extras.signOff.byUserId) && !view.launch.blockers.some((b) => b.kind === "SIGN_OFF_STALE");

/** Whether the sign-off button is offered: nothing open. */
export const canSignOff = (view: SetupDraftView): boolean => !view.launch.blockers.some((b) => b.kind === "OPEN_REQUIREMENTS");

type Report = import("../../../../lib/server/schemas-project-setup-draft.ts").LaunchReport;

/** The report as rows a person reads: a name, a state in words, and the sentences that explain a note or a failure. */
export function reportRows(report: Report, words: { areaLabel: Record<string, string>; state: Record<string, string> }): Array<{ key: string; name: string; state: string; detail: string[]; failed: boolean }> {
  const areas = report.areas.map((a) => ({ key: `area:${a.area}`, name: words.areaLabel[a.area] ?? a.area, state: words.state[a.status] ?? a.status, detail: [...(a.error ? [a.error] : []), ...a.notes], failed: a.status === "FAILED" }));
  const steps = report.steps.map((s) => ({ key: `step:${s.key}`, name: s.label, state: words.state[s.status] ?? s.status, detail: [...(s.error ? [s.error] : []), ...s.notes], failed: s.status === "FAILED" }));
  return [...areas, ...steps];
}

/** Whether the project is started, from the page's own view (a reload after launching) or the report just received. */
export const isStarted = (view: SetupDraftView, report: Report | null): boolean => report?.status === "LAUNCHED" || (view.status === "APPLIED" && view.appliedProjectId !== null);
export const startedProjectId = (view: SetupDraftView, report: Report | null): string | null => report?.projectId ?? view.appliedProjectId;
