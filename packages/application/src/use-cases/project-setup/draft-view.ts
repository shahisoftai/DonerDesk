import type { ReadingAreaRunState, ReadingLeftOutArea, SetupSourceInfo, LaunchSummary, LaunchVerdict, BudgetLineDef, BudgetSuggestion, FinanceSummary, FundingDef, IndicatorDef, LogframeNodeDef, RiskDef, PlaceDef, PlanCoverage, MethodSuggestion, PlannedActivityDef, ScheduleTimeline, SetupLinkSuggestion, Proposed, ProposedStatus, RequirementResult, SetupDraft, SetupExtras, SlideProgress } from "@donordesk/domain";
import { areaRunStates, leftOutFromRuns, SETUP_REQUIREMENTS, SLIDE_KEYS, emptyExtras, evaluateRequirements, gapInbox, planCoverage, SECTOR_TEMPLATES, budgetKeyOf, canLaunch, financeSummary, launchSummary, planKeyOf, scheduleTimeline, suggestBudgetLinks, slideProgress, suggestMethods, suggestSetupLinks } from "@donordesk/domain";
import type { StoredSetupProposal, StoredSetupRun } from "../../ports/project-setup.js";
import { STALE_AREA_RUN_MS } from "./proposal-state.js";

/** The wizard's draft of a stored proposal; a proposal made before the wizard has no decisions yet. */
export function draftOf(stored: StoredSetupProposal): SetupDraft {
  return { proposal: stored.proposal, extras: stored.extras ?? emptyExtras(true) };
}

/** The project's own facts as the slide shows them: the value if there is one (read from a document or typed), else null. */
export interface DraftFactsView {
  name: string | null;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string | null;
  summary: string | null;
}

export function factsOf(draft: SetupDraft): DraftFactsView {
  const f = draft.proposal.facts;
  const text = (item: { value: string | null; status: string }) => (item.status === "REJECTED" ? null : item.value);
  return { name: text(f.name), code: text(f.code), startDate: text(f.startDate), endDate: text(f.endDate), currency: text(f.currency), summary: text(f.summary) };
}

/** Where an item came from, for the badge on it: read from a document, suggested (by a pack), or typed by the person. */
export type ItemOrigin = "DOCUMENT" | "SUGGESTED" | "USER";

/** One proposed item as a slide lists it. `path` is the address an edit quotes ("indicators.3"). */
export interface DraftItemView<T> {
  path: string;
  status: ProposedStatus;
  origin: ItemOrigin;
  quote: string | null;
  /** Where in the documents it was read from (a block of one file), when it was read from one. */
  source: { documentId: string; block: number } | null;
  value: T;
}

export function originOf(item: Proposed<unknown>): ItemOrigin {
  return item.sourceQuote ? "DOCUMENT" : item.status === "EDITED" ? "USER" : "SUGGESTED";
}

/** The items of one list that have a value and were not rejected, each with its address in the full list. */
export function itemsOf<T>(field: string, items: ReadonlyArray<Proposed<T>>): Array<DraftItemView<T>> {
  return items.flatMap((item, i) => (item.value === null || item.status === "REJECTED" ? [] : [{ path: `${field}.${i}`, status: item.status, origin: originOf(item), quote: item.sourceQuote, source: item.sourceRef ? { documentId: item.sourceRef.documentId, block: item.sourceRef.block } : null, value: item.value }]));
}

/** What a slide needs to draw itself: the decisions, every requirement's state, the gap inbox and each slide's progress. */
export interface SetupDraftView {
  id: string;
  status: StoredSetupProposal["status"];
  /** The project made from this setup, once it has been started. */
  appliedProjectId: string | null;
  /** The version an edit quotes; read back from the store, never the clock. */
  updatedAt: Date;
  facts: DraftFactsView;
  logframe: Array<DraftItemView<LogframeNodeDef>>;
  indicators: Array<DraftItemView<IndicatorDef>>;
  places: Array<DraftItemView<PlaceDef>>;
  /** Planned activities; `planKey` is the address their links (place, indicators, lead) are kept under. */
  plan: Array<DraftItemView<PlannedActivityDef> & { planKey: string }>;
  /** Links the wizard offers for the work plan, each with its reason. */
  suggestions: SetupLinkSuggestion[];
  coverage: PlanCoverage;
  /** How each indicator without a method could be collected, with the reason. */
  methodSuggestions: MethodSuggestion[];
  /** The reporting calendar the project's dates and cadence give, with each period's due date. */
  timeline: ScheduleTimeline;
  funding: Array<DraftItemView<FundingDef>>;
  /** Budget lines; `budgetKey` is the address the activity chosen for the line is kept under. */
  budget: Array<DraftItemView<BudgetLineDef> & { budgetKey: string }>;
  budgetSuggestions: BudgetSuggestion[];
  financeSummary: FinanceSummary;
  risks: Array<DraftItemView<RiskDef>>;
  summary: LaunchSummary;
  /** Whether the project could start now, and what stops it. */
  launch: LaunchVerdict;
  dashboardOptions: Array<{ id: string; title: string; sector: string }>;
  /** The files the draft was read from and what each was read as; empty for a draft started with no documents. */
  sources: SetupSourceInfo[];
  /** What the reading could not find word for word in the documents, by part: shown, never silently dropped. */
  leftOut: ReadingLeftOutArea[];
  /** The state of each part's latest reading, so a part being read again can be shown and waited for. */
  areaRuns: Record<string, ReadingAreaRunState>;
  extras: SetupExtras;
  results: RequirementResult[];
  inbox: RequirementResult[];
  progress: SlideProgress[];
}

/** The reading runs of the draft, when they are known (a view built without them says nothing about readings). */
export interface ReadingRuns { runs: readonly StoredSetupRun[]; now: Date }

export function describeDraft(stored: StoredSetupProposal, reading?: ReadingRuns): SetupDraftView {
  const draft = draftOf(stored);
  const results = evaluateRequirements(draft, SETUP_REQUIREMENTS);
  return {
    id: stored.id,
    status: stored.status,
    appliedProjectId: stored.appliedProjectId ?? null,
    updatedAt: stored.updatedAt,
    facts: factsOf(draft),
    logframe: itemsOf("logframe", draft.proposal.logframe),
    indicators: itemsOf("indicators", draft.proposal.indicators),
    places: itemsOf("places", draft.proposal.places),
    plan: itemsOf("plan", draft.proposal.plan).map((i) => ({ ...i, planKey: planKeyOf(i.value) })),
    suggestions: suggestSetupLinks(draft),
    coverage: planCoverage(draft),
    methodSuggestions: suggestMethods(draft),
    timeline: scheduleTimeline(draft),
    funding: itemsOf("funding", draft.proposal.funding),
    budget: itemsOf("budget", draft.proposal.budget).map((i) => ({ ...i, budgetKey: budgetKeyOf(i.value) })),
    budgetSuggestions: suggestBudgetLinks(draft),
    financeSummary: financeSummary(draft),
    risks: itemsOf("risks", draft.proposal.risks),
    summary: launchSummary(draft),
    launch: canLaunch(results, draft),
    dashboardOptions: SECTOR_TEMPLATES.map((t) => ({ id: t.id, title: t.title, sector: t.sector })),
    sources: stored.proposal.sources ?? [],
    leftOut: reading ? leftOutFromRuns(reading.runs) : [],
    areaRuns: reading ? areaRunStates(reading.runs, reading.now, STALE_AREA_RUN_MS) : {},
    extras: draft.extras,
    results,
    inbox: gapInbox(results),
    progress: SLIDE_KEYS.map((slide) => slideProgress(results, slide)),
  };
}
