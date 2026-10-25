/**
 * The template registry (Phase 31): six professional compositions, each an ordered list of slots —
 * never a blank page, never a hand-drawn image. A template works with incomplete data by rule:
 * every section kind has a "not yet reported" state, so a planning-stage project still produces a
 * useful overview and nothing is ever invented to fill a slot.
 *
 * Adding a template is a new row here (and a copy-lint check for its label); nothing else changes.
 */
import type { InfographicConfig, InfographicProfile, InfographicSectionConfig } from "./composition.js";
import type { InfographicLabelKey } from "./labels.js";

export type InfographicTemplateId =
  | "OVERVIEW" | "PROGRESS" | "RESULTS" | "BUDGET" | "THEMATIC" | "CLOSURE"
  | "SNAPSHOT" | "AT_A_GLANCE" | "SECTOR_RESULTS" | "FUNDING_SNAPSHOT" | "COVERAGE_BY_LOCATION" | "BENEFICIARY_PROFILE"
  | "FLASH_UPDATE" | "DONOR_ONE_PAGER" | "ANNUAL_POSTER" | "FACTSHEET" | "STORY_CARD" | "SOCIAL_STORY"
  | "SLIDE_SUMMARY" | "RESULTS_CHAIN_PAGE" | "SECTOR_DASHBOARD" | "CUSTOM"
  | "PORTFOLIO_OVERVIEW" | "OPERATIONAL_PRESENCE";

export const INFOGRAPHIC_TEMPLATE_IDS: readonly InfographicTemplateId[] = [
  "OVERVIEW", "PROGRESS", "RESULTS", "BUDGET", "THEMATIC", "CLOSURE",
  "SNAPSHOT", "AT_A_GLANCE", "SECTOR_RESULTS", "FUNDING_SNAPSHOT", "COVERAGE_BY_LOCATION", "BENEFICIARY_PROFILE",
  "FLASH_UPDATE", "DONOR_ONE_PAGER", "ANNUAL_POSTER", "FACTSHEET", "STORY_CARD", "SOCIAL_STORY",
  "SLIDE_SUMMARY", "RESULTS_CHAIN_PAGE", "SECTOR_DASHBOARD", "CUSTOM",
  "PORTFOLIO_OVERVIEW", "OPERATIONAL_PRESENCE",
];

/** The product families the gallery groups templates under. */
export type InfographicTemplateFamily = "OVERVIEW" | "RESULTS" | "SNAPSHOT" | "FUNDING" | "PEOPLE" | "COMMS" | "REFERENCE" | "PORTFOLIO";

/** Bumped only when a template's default composition changes; saved designs pin the version they were made with. */
export const INFOGRAPHIC_TEMPLATE_VERSION = 1;

export interface InfographicTemplate {
  id: InfographicTemplateId;
  version: number;
  label: string;
  description: string;
  family: InfographicTemplateFamily;
  /** `PORTFOLIO` templates cover every project the person can see; the rest cover one project. */
  scope?: "PROJECT" | "PORTFOLIO";
  /** The page format, profile and theme a new design starts with (the user may change all three). */
  format?: string;
  profile?: InfographicProfile;
  themeId?: string;
  /** The composition a new design starts from; the user may hide, reorder and retune it. */
  sections: InfographicSectionConfig[];
}

const s = (kind: InfographicSectionConfig["kind"], rest: Partial<InfographicSectionConfig> = {}): InfographicSectionConfig => ({ kind, ...rest });


const num = (source: NonNullable<InfographicSectionConfig["numbers"]>[number]["source"], label: string, iconId?: string) => ({ source, label, ...(iconId ? { iconId } : {}) });

const MORE_TEMPLATES: Readonly<Record<Exclude<InfographicTemplateId, "OVERVIEW" | "PROGRESS" | "RESULTS" | "BUDGET" | "THEMATIC" | "CLOSURE">, InfographicTemplate>> = {
  SNAPSHOT: {
    id: "SNAPSHOT", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "SNAPSHOT", label: "Humanitarian snapshot",
    description: "One story: key messages, a map and a few charts, in three columns. Keep it to one theme.",
    format: "A4_PORTRAIT", profile: "SNAPSHOT", themeId: "HUMANITARIAN_BLUE",
    sections: [
      s("HERO", { span: 12 }),
      s("KEY_MESSAGES", { span: 4 }),
      s("MAP", { span: 4 }),
      s("DEMOGRAPHICS", { span: 4 }),
      s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check"), num("ACTIVITIES_PLANNED", "Activities planned", "calendar")] }),
      s("LEGEND_NOTES", { span: 12 }),
    ],
  },
  AT_A_GLANCE: {
    id: "AT_A_GLANCE", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "SNAPSHOT", label: "Response at a glance",
    description: "People in need, targeted and reached, with who they are and where we work.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT", themeId: "HUMANITARIAN_BLUE",
    sections: [
      s("HERO", { span: 12 }),
      s("FUNNEL", { span: 12, stages: [{ label: "People in need" }, { label: "People targeted" }, { label: "People reached", bind: "REACH_UNIQUE" }] }),
      s("DEMOGRAPHICS", { span: 6 }),
      s("MAP", { span: 6 }),
      s("PROGRESS_RINGS", { span: 12 }),
      s("LEGEND_NOTES", { span: 12 }),
    ],
  },
  SECTOR_RESULTS: {
    id: "SECTOR_RESULTS", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "RESULTS", label: "Results by sector",
    description: "One card per sector with its headline figures against target.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("SECTOR_GRID", { span: 12 }), s("PROGRESS_RINGS", { span: 12 }), s("TABLE", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  FUNDING_SNAPSHOT: {
    id: "FUNDING_SNAPSHOT", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "FUNDING", label: "Funding snapshot",
    description: "Budget, verified expenditure, balance and burn rate. Verified finance records only.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [
      s("HERO", { span: 12 }),
      s("BIG_NUMBERS", { span: 12, numbers: [num("FINANCE_BUDGET", "Approved budget", "coin"), num("FINANCE_EXPENDITURE", "Verified expenditure", "coin"), num("FINANCE_BALANCE", "Balance", "coin")] }),
      s("FUNDING", { span: 12 }),
      s("CHART", { span: 12, title: "Burn rate over time", chart: { template: "FINANCE_BURN_RATE", indicatorIds: [], measure: "PERIOD", type: "LINE" } }),
      s("LEGEND_NOTES", { span: 12 }),
    ],
  },
  COVERAGE_BY_LOCATION: {
    id: "COVERAGE_BY_LOCATION", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "OVERVIEW", label: "Coverage by location",
    description: "Where the work happens and how far it has got in each place.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("MAP", { span: 6 }), s("ACTIVITIES_BY_LOCATION", { span: 6 }), s("LOCATION_RESULTS", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  BENEFICIARY_PROFILE: {
    id: "BENEFICIARY_PROFILE", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "PEOPLE", label: "Who we reached",
    description: "People reached by sex and age, and where they live.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("REACH_REGISTERED", "People registered", "people")] }), s("DEMOGRAPHICS", { span: 6 }), s("MAP", { span: 6 }), s("REACH", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  FLASH_UPDATE: {
    id: "FLASH_UPDATE", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "SNAPSHOT", label: "Flash update",
    description: "A rapid update: what happened, key numbers, the timeline and what we are doing.",
    format: "A4_PORTRAIT", profile: "SNAPSHOT", themeId: "HUMANITARIAN_BLUE",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check")] }), s("TIMELINE", { span: 12 }), s("MAP", { span: 6 }), s("KEY_MESSAGES", { span: 6 }), s("LEGEND_NOTES", { span: 12 })],
  },
  DONOR_ONE_PAGER: {
    id: "DONOR_ONE_PAGER", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "RESULTS", label: "Donor one-pager",
    description: "Headline results, progress against targets and trends on one page.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check"), num("ACTIVITIES_PLANNED", "Activities planned", "calendar")] }), s("PROGRESS_RINGS", { span: 12 }), s("SMALL_MULTIPLES", { span: 12 }), s("KEY_MESSAGES", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  ANNUAL_POSTER: {
    id: "ANNUAL_POSTER", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "COMMS", label: "Annual results poster",
    description: "An A3 poster: headline numbers, map, sector results, timeline and a voice from the field.",
    format: "A3_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check"), num("FINANCE_EXPENDITURE", "Verified expenditure", "coin")] }), s("MAP", { span: 6 }), s("SECTOR_GRID", { span: 6 }), s("TIMELINE", { span: 12 }), s("QUOTE", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  FACTSHEET: {
    id: "FACTSHEET", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "REFERENCE", label: "Project factsheet",
    description: "A reference page: key messages, the indicator table and the results chain.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("KEY_MESSAGES", { span: 12 }), s("TABLE", { span: 12 }), s("RESULTS_CHAIN", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  STORY_CARD: {
    id: "STORY_CARD", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "COMMS", label: "Social card",
    description: "One number, one sentence and a photo, for a social feed.",
    format: "SQUARE", profile: "SOCIAL",
    sections: [s("IMAGE", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people")] }), s("QUOTE", { span: 12 })],
  },
  SOCIAL_STORY: {
    id: "SOCIAL_STORY", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "COMMS", label: "Story (vertical)",
    description: "A tall card for stories: a headline number, three messages and a photo.",
    format: "STORY", profile: "SOCIAL",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check")] }), s("KEY_MESSAGES", { span: 12 }), s("IMAGE", { span: 12 })],
  },
  SLIDE_SUMMARY: {
    id: "SLIDE_SUMMARY", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "COMMS", label: "Slide summary",
    description: "A 16:9 slide: headline numbers, progress and the map.",
    format: "SLIDE_16_9", profile: "INTERNAL",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check"), num("ACTIVITIES_PLANNED", "Activities planned", "calendar")] }), s("PROGRESS_RINGS", { span: 6 }), s("MAP", { span: 6 })],
  },
  RESULTS_CHAIN_PAGE: {
    id: "RESULTS_CHAIN_PAGE", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "REFERENCE", label: "Results chain",
    description: "Outputs, outcomes and impact with their latest values.",
    format: "A4_PORTRAIT", profile: "DONOR_REPORT",
    sections: [s("HERO", { span: 12 }), s("RESULTS_CHAIN", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  SECTOR_DASHBOARD: {
    id: "SECTOR_DASHBOARD", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "RESULTS", label: "Sector dashboard (landscape)",
    description: "A landscape one-pager: headline numbers, two charts, trends and an indicator table.",
    format: "A4_LANDSCAPE", profile: "INTERNAL",
    sections: [s("HERO", { span: 12 }), s("BIG_NUMBERS", { span: 12, numbers: [num("REACH_UNIQUE", "People reached", "people"), num("ACTIVITIES_DONE", "Activities completed", "check"), num("ACTIVITIES_PLANNED", "Activities planned", "calendar"), num("FINANCE_EXPENDITURE", "Verified expenditure", "coin")] }), s("SMALL_MULTIPLES", { span: 12 }), s("TABLE", { span: 12 })],
  },
  PORTFOLIO_OVERVIEW: {
    id: "PORTFOLIO_OVERVIEW", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "PORTFOLIO", scope: "PORTFOLIO", label: "Portfolio overview",
    description: "Every project you can see: how many, where, how delivery is going and what reports are due. No combined score.",
    format: "A4_PORTRAIT", profile: "INTERNAL",
    sections: [s("HERO", { span: 12 }), s("PORTFOLIO_SUMMARY", { span: 12 }), s("PORTFOLIO_HEALTH", { span: 6 }), s("PORTFOLIO_COUNTRIES", { span: 6 }), s("MAP", { span: 12 }), s("PORTFOLIO_TABLE", { span: 12 }), s("LEGEND_NOTES", { span: 12 })],
  },
  OPERATIONAL_PRESENCE: {
    id: "OPERATIONAL_PRESENCE", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "SNAPSHOT", label: "Who does what, where",
    description: "Which organizations work on what, in which places, with the map beside it. Typed by you, with its source.",
    format: "A4_PORTRAIT", profile: "SNAPSHOT", themeId: "HUMANITARIAN_BLUE",
    sections: [s("HERO", { span: 12 }), s("THREE_W", { span: 12 }), s("MAP", { span: 6 }), s("ACTIVITIES_BY_LOCATION", { span: 6 }), s("LEGEND_NOTES", { span: 12 })],
  },
  CUSTOM: {
    id: "CUSTOM", version: INFOGRAPHIC_TEMPLATE_VERSION, family: "REFERENCE", label: "Start with a headline",
    description: "A headline and your own key messages; add any blocks you need.",
    format: "A4_PORTRAIT", profile: "INTERNAL",
    sections: [s("HERO", { span: 12 }), s("KEY_MESSAGES", { span: 12 })],
  },
};

const CORE_TEMPLATES = {
  OVERVIEW: {
    id: "OVERVIEW",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "OVERVIEW",
    label: "Project Overview",
    description: "Key figures, where we work, objective and key indicators — at any project stage.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("MAP", { title: "Where we work", size: "HALF" }),
      s("TEXT", { title: "Objective", size: "HALF" }),
      s("LOCATION_RESULTS", { title: "Key indicators by location", size: "FULL" }),
      s("ACTIVITIES_BY_LOCATION", { title: "Planned activities by output and location", size: "HALF" }),
      s("REACH", { title: "People reached", size: "HALF" }),
    ],
  },
  PROGRESS: {
    id: "PROGRESS",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "RESULTS",
    label: "Implementation Progress",
    description: "Activities and milestones this period, delivery status and progress by location.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("ACTIVITIES_BY_LOCATION", { title: "Progress by location", size: "FULL" }),
      s("CHART", {
        size: "HALF",
        chart: { template: "STATUS_DISTRIBUTION", indicatorIds: [], measure: "PERIOD", type: "PIE" },
      }),
      s("REACH", { title: "People reached this period", size: "HALF" }),
      s("TEXT", { title: "What happened this period", size: "FULL" }),
    ],
  },
  RESULTS: {
    id: "RESULTS",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "RESULTS",
    label: "Results & Impact",
    description: "Targets and actuals, trends over periods and results by location where supported.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("LOCATION_RESULTS", { title: "Target vs actual by location", size: "FULL" }),
      s("LOCATION_COMPARISON", { title: "Location comparison", size: "FULL" }),
      s("TEXT", { title: "Outcome statements", size: "FULL" }),
    ],
  },
  BUDGET: {
    id: "BUDGET",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "FUNDING",
    label: "Budget Utilization",
    description: "Approved budget, verified expenditure, balance and burn rate. Finance records only.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("CHART", {
        title: "Budget vs expenditure",
        size: "FULL",
        chart: { template: "FINANCE_BUDGET_VS_SPEND", indicatorIds: [], measure: "PERIOD", type: "BAR" },
      }),
      s("CHART", {
        title: "Burn rate over time",
        size: "HALF",
        chart: { template: "FINANCE_BURN_RATE", indicatorIds: [], measure: "PERIOD", type: "LINE" },
      }),
      s("TEXT", { title: "About these figures", size: "HALF" }),
    ],
  },
  THEMATIC: {
    id: "THEMATIC",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "RESULTS",
    label: "Thematic Snapshot",
    description: "One sector's indicators, reach breakdowns and coverage for the chosen period.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("REACH", { title: "Reach by sex & age", size: "HALF" }),
      s("MAP", { title: "Reach by location", size: "HALF" }),
      s("LOCATION_RESULTS", { title: "Sector indicators", size: "FULL" }),
    ],
  },
  CLOSURE: {
    id: "CLOSURE",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    family: "REFERENCE",
    label: "Project Closure",
    description: "Final achievements, coverage by location, expenditure summary and lessons.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("LOCATION_RESULTS", { title: "Final achievement by location", size: "FULL" }),
      s("TEXT", { title: "Lessons learned", size: "HALF" }),
      s("TEXT", { title: "Changes of plan", size: "HALF" }),
    ],
  },
} as const satisfies Record<"OVERVIEW" | "PROGRESS" | "RESULTS" | "BUDGET" | "THEMATIC" | "CLOSURE", InfographicTemplate>;

export const INFOGRAPHIC_TEMPLATES: Readonly<Record<InfographicTemplateId, InfographicTemplate>> = { ...CORE_TEMPLATES, ...MORE_TEMPLATES };

export const INFOGRAPHIC_TEMPLATE_ORDER: readonly InfographicTemplateId[] = INFOGRAPHIC_TEMPLATE_IDS;

/** The heading a section shows when the officer did not author one — one label per slot kind (English; `sectionLabel` translates). */
export const DEFAULT_SECTION_LABEL: Readonly<Record<InfographicSectionConfig["kind"], string>> = {
  KPIS: "Key figures",
  CHART: "Chart",
  LOCATION_RESULTS: "Results by location",
  LOCATION_COMPARISON: "Location comparison",
  REACH: "People reached",
  ACTIVITIES_BY_LOCATION: "Activities by location",
  MAP: "Where we work",
  TEXT: "Notes",
  HERO: "Headline",
  BIG_NUMBERS: "Key figures",
  FUNNEL: "Reach against need",
  PROGRESS_RINGS: "Progress against targets",
  DEMOGRAPHICS: "Who we reached",
  SECTOR_GRID: "Results by sector",
  TIMELINE: "Timeline",
  KEY_MESSAGES: "Key messages",
  QUOTE: "In their words",
  IMAGE: "Photo",
  LEGEND_NOTES: "Notes and sources",
  BANNER: "Banner",
  FUNDING: "Funding",
  SMALL_MULTIPLES: "Trends",
  TABLE: "Indicators",
  RESULTS_CHAIN: "Results chain",
  DIVIDER: "Divider",
  PORTFOLIO_SUMMARY: "Portfolio at a glance",
  PORTFOLIO_TABLE: "Projects",
  PORTFOLIO_HEALTH: "Delivery health",
  PORTFOLIO_COUNTRIES: "Projects by country",
  THREE_W: "Who does what, where",
};

/** The label key a kind's default heading uses (null: the block draws no heading). */
export const SECTION_LABEL_KEY: Readonly<Record<InfographicSectionConfig["kind"], InfographicLabelKey | null>> = {
  KPIS: "keyFigures", CHART: "chart", LOCATION_RESULTS: "resultsByLocation", LOCATION_COMPARISON: "locationComparison", REACH: "peopleReached",
  ACTIVITIES_BY_LOCATION: "activitiesByLocation", MAP: "whereWeWork", TEXT: "notes", HERO: null, BIG_NUMBERS: "keyFigures", FUNNEL: "reachAgainstNeed",
  PROGRESS_RINGS: "progressAgainstTargets", DEMOGRAPHICS: "whoWeReached", SECTOR_GRID: "resultsBySector", TIMELINE: "timeline", KEY_MESSAGES: "keyMessages",
  QUOTE: "inTheirWords", IMAGE: null, LEGEND_NOTES: "notesAndSources", BANNER: null, FUNDING: "funding", SMALL_MULTIPLES: "trends", TABLE: "indicatorsTable",
  RESULTS_CHAIN: "resultsChain", DIVIDER: null,
  PORTFOLIO_SUMMARY: "portfolioSummary", PORTFOLIO_TABLE: "portfolioTable", PORTFOLIO_HEALTH: "portfolioHealth", PORTFOLIO_COUNTRIES: "portfolioCountries", THREE_W: "threeW",
};

export function templateById(id: string): InfographicTemplate | undefined {
  return (INFOGRAPHIC_TEMPLATES as Readonly<Record<string, InfographicTemplate | undefined>>)[id];
}

/** The registry as a plain map, for `validateConfig`. */
export function knownTemplates(): Map<string, { version: number }> {
  return new Map(Object.entries(INFOGRAPHIC_TEMPLATES).map(([id, template]) => [id, { version: template.version }]));
}

/** A new design from a template: its defaults, plus the user's title. */
export function configFromTemplate(templateId: string, title?: string): InfographicConfig | undefined {
  const template = templateById(templateId);
  if (!template) return undefined;
  return {
    templateId: template.id,
    templateVersion: template.version,
    ...(title?.trim() ? { title: title.trim() } : {}),
    ...(template.scope === "PORTFOLIO" ? { scope: "PORTFOLIO" as const } : {}),
    ...(template.format ? { format: template.format } : {}),
    ...(template.profile ? { profile: template.profile } : {}),
    ...(template.themeId ? { themeId: template.themeId } : {}),
    sections: template.sections.map((section) => JSON.parse(JSON.stringify(section)) as InfographicSectionConfig),
  };
}
