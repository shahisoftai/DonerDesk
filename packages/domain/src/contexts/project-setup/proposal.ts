/**
 * Project setup proposal (Phase 36): what the assistant proposes after reading a project document, before a person decides
 * anything. Every proposed value carries the verbatim quote it was read from and where it sits in the document, so a reviewer
 * can check it in one click. `null` is "Not stated": a target, a date or an amount the document does not state is never
 * guessed and never 0. Pure types: no behaviour lives here.
 */
import type { PlainDate } from "../workplan/plain-date.js";

/** How surely a value was read from its quote; grounding certifies HIGH, a model's own caution can only lower it. */
export type SetupConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ProposedStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "EDITED";

/** Where in the uploaded document a value was read from. */
export interface SourceRef {
  /** Which uploaded document (a proposal may be built from several; the UI ships one first). */
  documentId: string;
  /** The block's index inside that document, in reading order. */
  block: number;
  page?: number;
}

export interface Proposed<T> {
  /** null = "Not stated": the document does not say, and nothing is invented. */
  value: T | null;
  /** Verbatim quote (whitespace-normalised, at most 400 characters); null only when a person wrote or edited the value. */
  sourceQuote: string | null;
  sourceRef: SourceRef | null;
  confidence: SetupConfidence;
  status: ProposedStatus;
}

export type SetupLogLevel = "GOAL" | "OUTCOME" | "OUTPUT" | "ACTIVITY";

export interface LogframeNodeDef {
  level: SetupLogLevel;
  code: string | null;
  title: string | null;
  description: string | null;
  parentCode: string | null;
  /** GENERATED when the domain assigns the code because the document had none; never shown as if the document stated it. */
  codeSource?: "DOCUMENT" | "GENERATED";
}

export interface IndicatorDef {
  code: string | null;
  title: string | null;
  /** The logframe node this indicator measures; checked against the proposed logframe by `checkProposal`. */
  logframeCode: string | null;
  /** The document's kind of figure (NUMBER, PERCENTAGE, RATIO, CURRENCY); the applier validates against the indicator types. */
  type: string | null;
  unit: string | null;
  baseline: string | null;
  target: string | null;
  /** The target schedule as the document states it; the applier converts it to the cumulative form. */
  targetSchedule: string | null;
  frequency: string | null;
  /** Proposed direction ("higher is better" and the like); it stays unreviewed until a person confirms it. */
  direction: string | null;
  disaggregation: string[] | null;
  meansOfVerification: string | null;
  codeSource?: "DOCUMENT" | "GENERATED";
}

export interface PeriodDef {
  /** The cadence (MONTHLY, QUARTERLY, ...); the applier validates it with the period-type rules. */
  type: string | null;
  start: PlainDate | null;
  end: PlainDate | null;
}

export interface PlannedActivityDef {
  title: string | null;
  logframeCode: string | null;
  start: PlainDate | null;
  end: PlainDate | null;
  location: string | null;
  /** A lead is proposed as text only; assigning a real person stays manual. */
  lead: string | null;
}

export interface PlaceDef {
  name: string | null;
  /** 0 country ... 4 site, when the document states it; resolution happens at read time, never a guess. */
  adminLevel: number | null;
  parentName: string | null;
  /** Only when the document states coordinates; a place the gazetteer does not know stays "To confirm". */
  latitude: number | null;
  longitude: number | null;
}

export interface FundingDef {
  sourceName: string | null;
  /** As the document writes it; the locale-aware amount parser decides at apply time, ambiguity stays "Not stated". */
  amount: string | null;
  currency: string | null;
}

export interface BudgetLineDef {
  category: string | null;
  amount: string | null;
  currency: string | null;
  logframeCode: string | null;
}

export interface RiskDef {
  kind: string | null;
  title: string | null;
  seriousness: string | null;
  mitigation: string | null;
}

/** The project facts, field by field: each fact is its own review item. */
export interface ProposedFacts {
  name: Proposed<string>;
  code: Proposed<string>;
  donor: Proposed<string>;
  countries: Proposed<string[]>;
  sectors: Proposed<string[]>;
  startDate: Proposed<PlainDate>;
  endDate: Proposed<PlainDate>;
  currency: Proposed<string>;
  summary: Proposed<string>;
}

export interface ProjectSetupProposal {
  facts: ProposedFacts;
  logframe: Proposed<LogframeNodeDef>[];
  indicators: Proposed<IndicatorDef>[];
  periods: Proposed<PeriodDef>[];
  plan: Proposed<PlannedActivityDef>[];
  places: Proposed<PlaceDef>[];
  funding: Proposed<FundingDef>[];
  budget: Proposed<BudgetLineDef>[];
  risks: Proposed<RiskDef>[];
}
