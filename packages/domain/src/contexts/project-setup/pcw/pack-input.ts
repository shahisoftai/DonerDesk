/**
 * An organisation's own default pack (Phase 38). The administrator writes the starting answers once for a sector; the wizard
 * then offers them in place of the built-in ones. This is the one check a saved pack passes, and it only accepts what
 * `applyPack` can use: it holds no people, no donor and no document text. Pure.
 */
import { SECTORS } from "../../identity/role.js";
import { SECTOR_TEMPLATES } from "../../dashboards/sector-templates.js";
import type { RiskDef } from "../proposal.js";
import { FIXED_CADENCES } from "./schedule.js";
import type { DefaultPack, PackReportRule } from "./packs.js";

export interface PackInput {
  /** A sector key, or null/"" for the organisation's general pack. */
  sector?: string | null;
  label?: string;
  cadence?: string | null;
  reportRules?: ReadonlyArray<{ reportType?: string; template?: string; dueDaysAfterEnd?: number }>;
  reviewMode?: string | null;
  windowRule?: { opensDaysBefore?: number; closesDaysAfter?: number } | null;
  risks?: ReadonlyArray<{ title?: string; seriousness?: string; mitigation?: string; kind?: string }>;
  dashboardTemplate?: string | null;
}

export type PackProblem =
  | { code: "SECTOR_UNKNOWN"; sector: string } | { code: "LABEL_MISSING" } | { code: "CADENCE_UNKNOWN"; cadence: string }
  | { code: "RULE_INCOMPLETE"; index: number } | { code: "RULE_DAYS"; index: number } | { code: "REVIEW_MODE_UNKNOWN" }
  | { code: "WINDOW_DAYS" } | { code: "RISK_TITLE_MISSING"; index: number } | { code: "RISK_SERIOUSNESS"; index: number } | { code: "TOO_MANY_RISKS" }
  | { code: "TEMPLATE_UNKNOWN"; id: string };

export const PACK_LIMITS = { label: 80, risks: 15, ruleDays: 365, windowDays: 120, text: 300 } as const;

/** The key a sector's pack is stored under; the general pack uses "GENERAL". */
export const GENERAL_PACK_KEY = "GENERAL";
export const packKey = (sector: string | null): string => sector ?? GENERAL_PACK_KEY;

const SERIOUS = ["HIGH", "MEDIUM", "LOW"] as const;
const isDays = (n: unknown, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
const clean = (s: string | undefined, max: number): string => (s ?? "").trim().slice(0, max);

export function checkPackInput(input: PackInput): { ok: true; pack: DefaultPack } | { ok: false; problems: PackProblem[] } {
  const problems: PackProblem[] = [];
  const sector = input.sector?.trim() ? input.sector.trim().toUpperCase() : null;
  if (sector !== null && !(SECTORS as readonly string[]).includes(sector)) problems.push({ code: "SECTOR_UNKNOWN", sector });
  const label = clean(input.label, PACK_LIMITS.label);
  if (!label) problems.push({ code: "LABEL_MISSING" });
  const cadence = input.cadence?.trim() ? input.cadence.trim().toUpperCase() : undefined;
  if (cadence !== undefined && !(cadence in FIXED_CADENCES)) problems.push({ code: "CADENCE_UNKNOWN", cadence });

  const reportRules: PackReportRule[] = [];
  (input.reportRules ?? []).forEach((r, index) => {
    const reportType = (r.reportType ?? "").trim().toUpperCase();
    if (!reportType || r.dueDaysAfterEnd === undefined) return void problems.push({ code: "RULE_INCOMPLETE", index });
    if (!isDays(r.dueDaysAfterEnd, PACK_LIMITS.ruleDays)) return void problems.push({ code: "RULE_DAYS", index });
    // A donor's own layout is uploaded per project after it starts, so a pack only ever names the standard one.
    reportRules.push({ reportType, template: "BUILT_IN", dueDaysAfterEnd: r.dueDaysAfterEnd });
  });

  if (input.reviewMode && input.reviewMode !== "SIMPLE" && input.reviewMode !== "FULL") problems.push({ code: "REVIEW_MODE_UNKNOWN" });
  const w = input.windowRule;
  if (w && (!isDays(w.opensDaysBefore, PACK_LIMITS.windowDays) || !isDays(w.closesDaysAfter, PACK_LIMITS.windowDays))) problems.push({ code: "WINDOW_DAYS" });

  const rawRisks = input.risks ?? [];
  if (rawRisks.length > PACK_LIMITS.risks) problems.push({ code: "TOO_MANY_RISKS" });
  const risks: RiskDef[] = [];
  rawRisks.slice(0, PACK_LIMITS.risks).forEach((r, index) => {
    const title = clean(r.title, PACK_LIMITS.text);
    if (!title) return void problems.push({ code: "RISK_TITLE_MISSING", index });
    if (!(SERIOUS as readonly string[]).includes(r.seriousness ?? "")) return void problems.push({ code: "RISK_SERIOUSNESS", index });
    const kind = r.kind === "ASSUMPTION" ? "ASSUMPTION" : "RISK";
    risks.push({ kind, title, seriousness: r.seriousness!, mitigation: clean(r.mitigation, PACK_LIMITS.text) || null });
  });

  const dashboard = input.dashboardTemplate?.trim() || undefined;
  if (dashboard && !SECTOR_TEMPLATES.some((t) => t.id === dashboard)) problems.push({ code: "TEMPLATE_UNKNOWN", id: dashboard });

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    pack: {
      id: `org:${packKey(sector)}`, sector, source: "ORGANISATION", label, reportRules, risks,
      ...(cadence ? { cadence } : {}), ...(input.reviewMode ? { reviewMode: input.reviewMode as "SIMPLE" | "FULL" } : {}),
      ...(w ? { windowRule: { opensDaysBefore: w.opensDaysBefore!, closesDaysAfter: w.closesDaysAfter! } } : {}),
      ...(dashboard ? { dashboardTemplate: dashboard } : {}),
    },
  };
}

/** A fault in one plain sentence (the settings screen shows it as it is). */
export function describePackProblem(p: PackProblem): string {
  switch (p.code) {
    case "SECTOR_UNKNOWN": return "That sector is not one DonorDesk knows.";
    case "LABEL_MISSING": return "Give the pack a name.";
    case "CADENCE_UNKNOWN": return "Choose monthly or quarterly, or leave the frequency empty.";
    case "RULE_INCOMPLETE": return `Report ${p.index + 1} needs a kind of report and a due date.`;
    case "RULE_DAYS": return `Report ${p.index + 1}: the due date is a whole number of days from 0 to ${PACK_LIMITS.ruleDays}.`;
    case "REVIEW_MODE_UNKNOWN": return "Choose simple or full review.";
    case "WINDOW_DAYS": return `The entry window is a whole number of days from 0 to ${PACK_LIMITS.windowDays}, both before and after.`;
    case "RISK_TITLE_MISSING": return `Risk ${p.index + 1} needs a description.`;
    case "RISK_SERIOUSNESS": return `Risk ${p.index + 1} needs a seriousness: high, medium or low.`;
    case "TOO_MANY_RISKS": return `A pack holds at most ${PACK_LIMITS.risks} risks.`;
    case "TEMPLATE_UNKNOWN": return "That starting dashboard does not exist.";
  }
}
