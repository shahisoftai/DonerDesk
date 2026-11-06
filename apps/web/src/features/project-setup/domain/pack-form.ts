import type { PackView } from "../../../lib/server/schemas-setup-packs.ts";

export interface PackFormState {
  sector: string;
  label: string;
  cadence: string;
  reviewMode: string;
  opens: string;
  closes: string;
  rules: Array<{ reportType: string; due: string }>;
  risks: Array<{ title: string; seriousness: string; mitigation: string }>;
  dashboard: string;
}

export const GENERAL = "GENERAL";

/** The form for a sector: the organisation's own pack if it has one, else a copy of the built-in one to start from. */
export function formFrom(sectorKey: string, pack: PackView | null): PackFormState {
  return {
    sector: sectorKey,
    label: pack?.label ?? "",
    cadence: pack?.cadence ?? "",
    reviewMode: pack?.reviewMode ?? "",
    opens: pack?.windowRule ? String(pack.windowRule.opensDaysBefore) : "",
    closes: pack?.windowRule ? String(pack.windowRule.closesDaysAfter) : "",
    rules: (pack?.reportRules ?? []).map((r) => ({ reportType: r.reportType, due: String(r.dueDaysAfterEnd) })),
    risks: (pack?.risks ?? []).map((r) => ({ title: r.title ?? "", seriousness: r.seriousness ?? "MEDIUM", mitigation: r.mitigation ?? "" })),
    dashboard: pack?.dashboardTemplate ?? "",
  };
}

const days = (text: string): number => (text.trim() === "" ? Number.NaN : Number(text));

/** The request the server checks. Blank days stay NaN-free: an empty window is left out, a half-filled one is sent so the server names it. */
export function inputFrom(f: PackFormState) {
  const windowGiven = f.opens.trim() !== "" || f.closes.trim() !== "";
  return {
    sector: f.sector === GENERAL ? null : f.sector,
    label: f.label,
    cadence: f.cadence || null,
    reviewMode: f.reviewMode || null,
    windowRule: windowGiven ? { opensDaysBefore: Number.isNaN(days(f.opens)) ? -1 : days(f.opens), closesDaysAfter: Number.isNaN(days(f.closes)) ? -1 : days(f.closes) } : null,
    reportRules: f.rules.map((r) => ({ reportType: r.reportType, dueDaysAfterEnd: Number.isNaN(days(r.due)) ? -1 : days(r.due) })),
    risks: f.risks.map((r) => ({ title: r.title, seriousness: r.seriousness, mitigation: r.mitigation })),
    dashboardTemplate: f.dashboard || null,
  };
}
