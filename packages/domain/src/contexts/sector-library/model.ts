/**
 * The sector library (Phase 46): the shapes only. Content lives in `data/`, the rules in their own modules, and the registries
 * (`sectors.ts`, `sources.ts`, `kinds.ts`) say which sectors, sources and indicator kinds exist. Nothing here has behaviour, so
 * every consumer can depend on a type without depending on a rule (interface segregation).
 */
import type { DisaggregationDimension } from "../logframe/indicator-disaggregation.js";

/** Stable ids. A sector is added by a row in `SECTOR_REGISTRY`, never by editing a switch. */
export const LIBRARY_SECTOR_IDS = [
  "WASH", "HEALTH", "NUTRITION", "FOOD_SECURITY", "SHELTER_NFI", "CCCM", "PROTECTION", "CHILD_PROTECTION", "GBV", "HLP", "MINE_ACTION",
  "EDUCATION", "EARLY_RECOVERY", "LOGISTICS", "TELECOMS", "COORDINATION", "CASH",
  "AGRICULTURE", "ECONOMIC_DEVELOPMENT", "SOCIAL_PROTECTION", "GOVERNANCE", "PEACEBUILDING", "CLIMATE_DRR", "ENVIRONMENT_ENERGY",
  "GENDER_EQUALITY", "DISABILITY_INCLUSION", "MIGRATION_DISPLACEMENT", "MHPSS", "INFRASTRUCTURE", "LOCALISATION",
  "PROTECTION_AAP", "MEAL", "FINANCE_GRANTS", "SAFEGUARDING",
] as const;
export type LibrarySectorId = (typeof LIBRARY_SECTOR_IDS)[number];

export const LIBRARY_SOURCE_IDS = [
  "SPHERE_2018", "CHS_2014", "CPMS_2019", "INEE_2010", "LEGS", "MERS", "CCCM_CLUSTER", "GBVIE_2019", "IASC", "MISP", "IMAS", "CALP",
  "WHO", "SMART", "IPC", "DHIS2", "CLUSTER_REGISTRY", "OCHA_HRP", "SDG", "UNHCR_RBM", "UNICEF_CCC", "WFP_CRF", "FAO", "IFRC",
  "IATI", "DONOR_FRAMEWORKS", "DONORDESK",
] as const;
export type LibrarySourceId = (typeof LIBRARY_SOURCE_IDS)[number];

export type LibraryLevel = "GOAL" | "OUTCOME" | "OUTPUT" | "ACTIVITY";
export type LibraryIndicatorKind = "COUNT" | "RATE" | "RATIO" | "INDEX" | "BINARY" | "QUALITATIVE";
export type LibraryDirection = "HIGHER" | "LOWER" | "NEUTRAL";
export type LibraryAggregation = "SUM" | "AVERAGE" | "LATEST";
export type LibraryReviewStatus = "UNREVIEWED" | "IN_REVIEW" | "REVIEWED" | "DEPRECATED";

export interface LibrarySourceRef {
  sourceId: LibrarySourceId;
  /** The standard, commitment, indicator code or section the entry follows ("Water supply 2.1"). */
  standard?: string;
  note?: string;
}

export interface LibrarySource {
  id: LibrarySourceId;
  name: string;
  publisher: string;
  /** The edition or year the entries were written against; recorded, never assumed current. */
  edition: string;
  licence: string;
  url?: string;
  /** Sectors the source is mainly about; used by the coverage report, not by any rule. */
  mainlyFor: readonly LibrarySectorId[];
}

/** A published minimum or benchmark. It is a reference to compare with, never a target (the user confirms a target). */
export interface ReferenceStandard {
  comparator: "GTE" | "LTE" | "BETWEEN" | "EQ";
  value?: number;
  min?: number;
  max?: number;
  unit: string;
  /** Who or what it applies to, in a few words ("every household", "per treatment programme"). */
  appliesTo: string;
  sourceRef: LibrarySourceRef;
  /** True once someone checked the figure against the source; false while it is recalled and waiting for review. */
  verified: boolean;
}

export interface ReviewState {
  status: LibraryReviewStatus;
  reviewer?: string;
  reviewedOn?: string;
  note?: string;
}

export interface LibraryIndicator {
  /** Stable for ever; an adopted indicator keeps it. */
  id: string;
  sectorId: LibrarySectorId;
  /** Other sectors that use the same indicator; it is listed once, under its own sector, and offered under these. */
  alsoIn?: readonly LibrarySectorId[];
  /** The standard or theme the picker groups it under ("Water supply: access and quantity"). */
  group: string;
  name: string;
  /** One or two sentences: what is counted, for whom, over what time. */
  definition: string;
  numerator?: string;
  denominator?: string;
  kind: LibraryIndicatorKind;
  unit: string;
  direction: LibraryDirection;
  aggregation: LibraryAggregation;
  frequency: string;
  level: LibraryLevel;
  disaggregations: readonly DisaggregationDimension[];
  /** The breakdown categories the entry form should start with, by dimension. */
  categories?: Partial<Record<DisaggregationDimension, readonly string[]>>;
  referenceStandard?: ReferenceStandard;
  meansOfVerification: readonly string[];
  dataSources: readonly string[];
  sourceRef: LibrarySourceRef;
  /** A role key shared with dashboard templates, so a template maps this indicator with certainty. */
  roleKey?: string;
  /** Offered as ticked when a person asks for the recommended set. */
  recommended: boolean;
  tags: readonly string[];
  review: ReviewState;
  version: number;
  /** Set when a later entry replaces this one; adopted copies are told. */
  deprecatedBy?: string;
}

export interface LogframeSkeletonNode {
  /** Local key, unique inside the sector; children name it as `parent`. */
  key: string;
  level: LibraryLevel;
  title: string;
  parent?: string;
  /** Sphere/standard ids this node answers to, shown as a hint. */
  standards?: readonly string[];
  /** A starting assumption for this result, written like any library text: unreviewed until a person confirms it. Optional; none is shipped yet. */
  assumption?: string;
}

export type AssessmentAnswerType = "NUMBER" | "TEXT" | "YES_NO" | "CHOICE";
export interface AssessmentQuestion {
  key: string;
  question: string;
  answerType: AssessmentAnswerType;
  choices?: readonly string[];
  unit?: string;
  /** Why the question matters, in one sentence. */
  why: string;
  required: boolean;
}

export interface FormFieldSketch { label: string; type: "NUMBER" | "TEXT" | "DATE" | "CHOICE" | "YES_NO" | "PLACE" | "PHOTO"; required: boolean; choices?: readonly string[] }
export interface FormSketch { key: string; title: string; purpose: string; fields: readonly FormFieldSketch[]; feeds?: readonly string[] }

export interface LibraryEvidenceType { key: string; name: string; description: string; confidentiality: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "HIGHLY_SENSITIVE" }
export interface LibraryChecklistItem { key: string; title: string; description: string; severity: "critical" | "high" | "medium" | "low"; kind: "STATE" | "ATTESTATION"; standard?: string }
export interface RiskSketch { title: string; kind: "RISK" | "PROBLEM" | "ASSUMPTION"; seriousness: "LOW" | "MEDIUM" | "HIGH"; mitigation: string }
export interface GlossaryEntry { term: string; meaning: string }
export interface BlueprintSection { title: string; guidance: string }

/** What a sector offers besides indicators. Every part is optional data; a provider turns it into a pack part. */
export interface SectorContent {
  sectorId: LibrarySectorId;
  summary: string;
  indicators: readonly LibraryIndicator[];
  logframe: readonly LogframeSkeletonNode[];
  assessment: readonly AssessmentQuestion[];
  forms: readonly FormSketch[];
  evidence: readonly LibraryEvidenceType[];
  checklist: readonly LibraryChecklistItem[];
  risks: readonly RiskSketch[];
  glossary: readonly GlossaryEntry[];
  blueprint: readonly BlueprintSection[];
  /** Existing dashboard template ids this sector uses; a sector with none gets one built from its role keys. */
  dashboardTemplates: readonly string[];
  /** Why a part is empty, when it is. The coverage report requires a reason for every empty part. */
  noneBecause?: Partial<Record<PackPartKey, string>>;
}

export const PACK_PART_KEYS = [
  "indicators", "logframe", "assessment", "forms", "evidence", "checklist", "risks", "glossary", "blueprint", "dashboards", "infographics",
] as const;
export type PackPartKey = (typeof PACK_PART_KEYS)[number];
