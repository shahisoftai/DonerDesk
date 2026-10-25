/**
 * The blocks the Studio can add (Phase 32.4): what each is called, which group it sits in, the narrowest
 * width it reads well at, and the section it starts as. One table, so the "Add a block" gallery, the width
 * choices and the defaults cannot disagree. Words are plain; nothing here shows a raw code.
 */
import { GRID_SPANS, PORTFOLIO_KINDS, type InfographicSectionConfig, type InfographicSectionKind } from "@donordesk/domain/contexts/infographics/index.js";

export type BlockGroup = "STORY" | "NUMBERS" | "PEOPLE" | "PLACES" | "RESULTS" | "MONEY" | "STRUCTURE" | "PORTFOLIO";

export const BLOCK_GROUPS: ReadonlyArray<{ id: BlockGroup; label: string }> = [
  { id: "STORY", label: "Headline and story" },
  { id: "NUMBERS", label: "Headline numbers" },
  { id: "PEOPLE", label: "People" },
  { id: "PLACES", label: "Places" },
  { id: "RESULTS", label: "Results" },
  { id: "MONEY", label: "Money" },
  { id: "STRUCTURE", label: "Time and structure" },
  { id: "PORTFOLIO", label: "Portfolio" },
];

export interface BlockInfo {
  label: string;
  description: string;
  group: BlockGroup;
  /** The narrowest width (in grid columns of 12) the block reads well at. */
  minSpan: number;
  /** The block shows project records (so a project with none shows "Not yet reported") rather than only what is typed. */
  usesRecords: boolean;
  make(): InfographicSectionConfig;
}

const info = (label: string, description: string, group: BlockGroup, minSpan: number, usesRecords: boolean, make: () => InfographicSectionConfig): BlockInfo => ({ label, description, group, minSpan, usesRecords, make });

export const BLOCK_CATALOG: Readonly<Record<InfographicSectionKind, BlockInfo>> = {
  HERO: info("Headline banner", "The title, a sentence under it, and an optional photo.", "STORY", 12, false, () => ({ kind: "HERO", span: 12 })),
  KEY_MESSAGES: info("Key messages", "Three to five short statements, each with a number or an icon.", "STORY", 4, false, () => ({ kind: "KEY_MESSAGES", span: 6 })),
  QUOTE: info("Quotation", "What a person said, with who said it and an optional photo.", "STORY", 6, false, () => ({ kind: "QUOTE", span: 12 })),
  BANNER: info("Banner line", "One strong line across the page, such as a thank-you.", "STORY", 12, false, () => ({ kind: "BANNER", span: 12 })),
  TEXT: info("Text", "A short paragraph of your own words.", "STORY", 3, false, () => ({ kind: "TEXT", span: 6 })),
  IMAGE: info("Photo", "A picture from your library, with a caption and credit.", "STORY", 4, false, () => ({ kind: "IMAGE", span: 6 })),
  BIG_NUMBERS: info("Big numbers", "Up to six headline figures with an icon each, from your records or typed with a source.", "NUMBERS", 4, true, () => ({
    kind: "BIG_NUMBERS",
    span: 12,
    numbers: [
      { source: "REACH_UNIQUE", label: "People reached", iconId: "people" },
      { source: "ACTIVITIES_DONE", label: "Activities completed", iconId: "check" },
    ],
  })),
  KPIS: info("Key figures (classic)", "Four standard figures: people reached, locations, activities, balance.", "NUMBERS", 12, true, () => ({ kind: "KPIS", span: 12 })),
  PROGRESS_RINGS: info("Progress rings", "How far each indicator is towards its target.", "NUMBERS", 6, true, () => ({ kind: "PROGRESS_RINGS", span: 12 })),
  FUNNEL: info("Need, target and reach", "People in need, people targeted and people reached, narrowing down.", "NUMBERS", 6, true, () => ({
    kind: "FUNNEL",
    span: 12,
    stages: [{ label: "People in need" }, { label: "People targeted" }, { label: "People reached", bind: "REACH_UNIQUE" }],
  })),
  DEMOGRAPHICS: info("Who we reached", "People reached by sex and by age group.", "PEOPLE", 4, true, () => ({ kind: "DEMOGRAPHICS", span: 6 })),
  REACH: info("People reached by place", "Unique people reached in each location.", "PEOPLE", 4, true, () => ({ kind: "REACH", span: 6 })),
  MAP: info("Map", "Where the work happens, with pins and a legend; areas can be shaded by a figure.", "PLACES", 4, true, () => ({ kind: "MAP", span: 6 })),
  LOCATION_RESULTS: info("Results by location", "Target and achieved for each indicator in each location.", "PLACES", 8, true, () => ({ kind: "LOCATION_RESULTS", span: 12 })),
  LOCATION_COMPARISON: info("Location comparison", "Locations side by side across indicators.", "PLACES", 8, true, () => ({ kind: "LOCATION_COMPARISON", span: 12 })),
  ACTIVITIES_BY_LOCATION: info("Activities by location", "Activities done against planned in each place.", "PLACES", 4, true, () => ({ kind: "ACTIVITIES_BY_LOCATION", span: 6 })),
  CHART: info("Chart", "Any Data Center chart: over time, against target, by status.", "RESULTS", 4, true, () => ({
    kind: "CHART",
    span: 6,
    chart: { template: "STATUS_DISTRIBUTION", indicatorIds: [], measure: "PERIOD", type: "PIE" },
  })),
  SMALL_MULTIPLES: info("Trends", "A small chart for each indicator, side by side.", "RESULTS", 6, true, () => ({ kind: "SMALL_MULTIPLES", span: 12 })),
  SECTOR_GRID: info("Results by sector", "A card per sector with its headline indicators.", "RESULTS", 6, true, () => ({ kind: "SECTOR_GRID", span: 12, sectors: [{ label: "New sector", indicatorIds: [] }] })),
  TABLE: info("Indicator table", "Baseline, target, latest value and percent of target.", "RESULTS", 8, true, () => ({ kind: "TABLE", span: 12 })),
  RESULTS_CHAIN: info("Results chain", "Outputs, outcomes and impact with their latest values.", "RESULTS", 8, true, () => ({ kind: "RESULTS_CHAIN", span: 12 })),
  FUNDING: info("Funding", "Budget against spending, period by period. Verified finance only.", "MONEY", 8, true, () => ({ kind: "FUNDING", span: 12 })),
  TIMELINE: info("Timeline", "Dated events, in order.", "STRUCTURE", 6, false, () => ({ kind: "TIMELINE", span: 12 })),
  LEGEND_NOTES: info("Notes and sources", "Your notes, then where the data comes from.", "STRUCTURE", 6, true, () => ({ kind: "LEGEND_NOTES", span: 12 })),
  THREE_W: info("Who does what, where", "Organizations, what they do and the places they work in, as a table of ticks. You type it, with its source.", "PLACES", 8, false, () => ({ kind: "THREE_W", span: 12, presence: [{ who: "", what: "", where: [] }] })),
  PORTFOLIO_SUMMARY: info("Portfolio at a glance", "Projects, countries, behind, needing attention, open risks and overdue reports.", "PORTFOLIO", 8, true, () => ({ kind: "PORTFOLIO_SUMMARY", span: 12 })),
  PORTFOLIO_HEALTH: info("Delivery health", "How many projects are on track, need attention, are behind or have no plan yet.", "PORTFOLIO", 4, true, () => ({ kind: "PORTFOLIO_HEALTH", span: 6 })),
  PORTFOLIO_COUNTRIES: info("Projects by country", "Projects in each country, coloured by how delivery is going.", "PORTFOLIO", 4, true, () => ({ kind: "PORTFOLIO_COUNTRIES", span: 6 })),
  PORTFOLIO_TABLE: info("Projects", "Every project with its country, donor, delivery and next report.", "PORTFOLIO", 8, true, () => ({ kind: "PORTFOLIO_TABLE", span: 12 })),
  DIVIDER: info("Divider", "A thin line between parts of the page.", "STRUCTURE", 12, false, () => ({ kind: "DIVIDER", span: 12 })),
};

export const BLOCK_ORDER = Object.keys(BLOCK_CATALOG) as InfographicSectionKind[];

export type DesignScopeName = "PROJECT" | "PORTFOLIO";

/** The blocks a design of this scope may use: a portfolio page has only portfolio blocks, a map and what is typed; a project page has everything else. */
export function blocksForScope(scope: DesignScopeName): InfographicSectionKind[] {
  return BLOCK_ORDER.filter((kind) => (scope === "PORTFOLIO" ? PORTFOLIO_KINDS.has(kind) : !kind.startsWith("PORTFOLIO_")));
}

/** The widths this block may take: from its narrowest up to the full page. */
export function spanChoices(kind: InfographicSectionKind): number[] {
  const min = BLOCK_CATALOG[kind].minSpan;
  return GRID_SPANS.filter((span) => span >= min);
}

export const SPAN_LABEL: Readonly<Record<number, string>> = { 3: "Quarter", 4: "Third", 6: "Half", 8: "Two thirds", 9: "Three quarters", 12: "Full width" };

/** A fresh, valid section of this kind. */
export function newSection(kind: InfographicSectionKind): InfographicSectionConfig {
  return JSON.parse(JSON.stringify(BLOCK_CATALOG[kind].make())) as InfographicSectionConfig;
}

/** A copy of a section, to sit after the original. */
export function duplicateSection(section: InfographicSectionConfig): InfographicSectionConfig {
  const copy = JSON.parse(JSON.stringify(section)) as InfographicSectionConfig;
  if (copy.title) copy.title = `${copy.title} (copy)`.slice(0, 120);
  return copy;
}
