/**
 * Default packs (Phase 38): a sector's usual starting answers — reporting cadence and report rules, review mode, entry window,
 * standard risks and the dashboard template. Packs are chosen by SECTOR only, never by donor
 * (decision D8): what a donor requires differs per project and comes from that project's own documents and template.
 *
 * A pack only fills, never overwrites (the same rule as `applyNarrativeProposal`): anything the person or a document already
 * set stays. Suggested risks arrive undecided so a person still accepts or rejects them. A pack holds no people, so a rule's
 * approver is left for the person to choose. Pure; the data lives in `packs-built-in.ts` and in the organisation's own copies.
 */
import type { Proposed, RiskDef } from "../proposal.js";
import type { ReportTypeRule, SetupDraft, SetupReviewMode, WindowRule } from "./draft.js";

export interface PackReportRule {
  reportType: string;
  /** A template id or "BUILT_IN". */
  template: string;
  dueDaysAfterEnd: number;
}

export interface DefaultPack {
  id: string;
  /** null = the generic pack, used when no sector pack exists. */
  sector: string | null;
  source: "BUILT_IN" | "ORGANISATION";
  label: string;
  cadence?: string;
  reportRules: readonly PackReportRule[];
  reviewMode?: SetupReviewMode;
  windowRule?: WindowRule;
  risks: readonly RiskDef[];
  dashboardTemplate?: string;
}

/** The organisation's own pack for the sector, else the built-in one, else the organisation's generic, else the built-in generic. */
export function resolvePack(packs: readonly DefaultPack[], sector: string | undefined): DefaultPack | null {
  const pick = (source: DefaultPack["source"], s: string | null) => packs.find((p) => p.source === source && p.sector === s);
  const wanted = sector?.trim() ? sector.trim().toUpperCase() : null;
  return (wanted && (pick("ORGANISATION", wanted) ?? pick("BUILT_IN", wanted))) || pick("ORGANISATION", null) || pick("BUILT_IN", null) || null;
}

export interface PackApplication {
  draft: SetupDraft;
  /** What the pack filled, by plain name, so the screen can say so ("Report rules, Suggested risks (2)"). */
  filled: string[];
}

const suggestedRisk = (risk: RiskDef): Proposed<RiskDef> => ({ value: risk, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" });

export function applyPack(draft: SetupDraft, pack: DefaultPack): PackApplication {
  const filled: string[] = [];
  const { schedule, collection, dashboardTemplate } = draft.extras;
  const nextSchedule = { ...schedule };
  if (nextSchedule.cadence === undefined && pack.cadence) {
    nextSchedule.cadence = pack.cadence;
    filled.push("Reporting cadence");
  }
  if (nextSchedule.rules.length === 0 && pack.reportRules.length > 0) {
    nextSchedule.rules = pack.reportRules.map((r): ReportTypeRule => ({ reportType: r.reportType, template: r.template, dueDaysAfterEnd: r.dueDaysAfterEnd }));
    filled.push("Report rules");
  }
  const nextCollection = { ...collection };
  if (nextCollection.reviewMode === undefined && pack.reviewMode) { nextCollection.reviewMode = pack.reviewMode; filled.push("Review mode"); }
  if (nextCollection.windowRule === undefined && pack.windowRule) { nextCollection.windowRule = pack.windowRule; filled.push("Entry window"); }

  const titles = new Set(draft.proposal.risks.map((r) => (r.value?.title ?? "").trim().toLowerCase()));
  const newRisks = pack.risks.filter((r) => !titles.has((r.title ?? "").trim().toLowerCase()));
  if (newRisks.length > 0) filled.push(`Suggested risks (${newRisks.length})`);

  const nextDashboard = dashboardTemplate ?? pack.dashboardTemplate;
  if (dashboardTemplate === undefined && pack.dashboardTemplate) filled.push("Dashboard");

  return {
    filled,
    draft: {
      proposal: { ...draft.proposal, risks: [...draft.proposal.risks, ...newRisks.map(suggestedRisk)] },
      extras: {
        ...draft.extras,
        start: { ...draft.extras.start, packId: pack.id },
        schedule: nextSchedule,
        collection: nextCollection,
        ...(nextDashboard !== undefined ? { dashboardTemplate: nextDashboard } : {}),
      },
    },
  };
}
