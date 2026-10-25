/**
 * What a saved infographic is (Phase 31): a composition, never a copy of project data. A config
 * names the template, the periods and indicators to show, the sections in their order, and the
 * words the user authored. Everything else — the figures — is read from project records at
 * generation time and snapshotted only in published exports.
 *
 * Validation is total: a config that names an unknown template, an unknown chart template, the
 * wrong number of indicators for that chart, or an oversized authored text is refused here, before
 * any renderer sees it.
 */
import { DomainError } from "../../core/domain-error.js";
import type { Result } from "../../core/result.js";
import { CHART_MEASURES, type ChartMeasure } from "../reporting/data-sheet.js";
import { CHART_TYPES, type ChartType } from "../reporting/chart-config.js";
import { DATA_CHART_TEMPLATES, type DataChartTemplate } from "../reporting/data-charts.js";
import { themeById } from "./theme.js";
import { formatById, GRID_SPANS, SIZE_TO_SPAN } from "./formats.js";
import { iconById } from "./icons.js";
import { INFOGRAPHIC_LANGUAGES, INFOGRAPHIC_ROUNDINGS, type InfographicRounding } from "./labels.js";

/** The slot kinds a template (and the Studio) can compose. Each maps to one renderer block. */
export type InfographicSectionKind =
  | "KPIS"
  | "CHART"
  | "LOCATION_RESULTS"
  | "LOCATION_COMPARISON"
  | "REACH"
  | "ACTIVITIES_BY_LOCATION"
  | "MAP"
  | "TEXT"
  // Phase 32 blocks
  | "HERO"
  | "BIG_NUMBERS"
  | "FUNNEL"
  | "PROGRESS_RINGS"
  | "DEMOGRAPHICS"
  | "SECTOR_GRID"
  | "TIMELINE"
  | "KEY_MESSAGES"
  | "QUOTE"
  | "IMAGE"
  | "LEGEND_NOTES"
  | "BANNER"
  | "FUNDING"
  | "SMALL_MULTIPLES"
  | "TABLE"
  | "RESULTS_CHAIN"
  | "DIVIDER"
  // Portfolio blocks (a design that covers every project the person can see)
  | "PORTFOLIO_SUMMARY"
  | "PORTFOLIO_TABLE"
  | "PORTFOLIO_HEALTH"
  | "PORTFOLIO_COUNTRIES"
  // Authored operational-presence matrix: who does what, where
  | "THREE_W";

export const INFOGRAPHIC_SECTION_KINDS: readonly InfographicSectionKind[] = [
  "KPIS",
  "CHART",
  "LOCATION_RESULTS",
  "LOCATION_COMPARISON",
  "REACH",
  "ACTIVITIES_BY_LOCATION",
  "MAP",
  "TEXT",
  "HERO",
  "BIG_NUMBERS",
  "FUNNEL",
  "PROGRESS_RINGS",
  "DEMOGRAPHICS",
  "SECTOR_GRID",
  "TIMELINE",
  "KEY_MESSAGES",
  "QUOTE",
  "IMAGE",
  "LEGEND_NOTES",
  "BANNER",
  "FUNDING",
  "SMALL_MULTIPLES",
  "TABLE",
  "RESULTS_CHAIN",
  "DIVIDER",
  "PORTFOLIO_SUMMARY",
  "PORTFOLIO_TABLE",
  "PORTFOLIO_HEALTH",
  "PORTFOLIO_COUNTRIES",
  "THREE_W",
];

/** What a design is for. The profile chooses which Design-check rules apply (never what is drawn). */
export type InfographicProfile = "SNAPSHOT" | "DONOR_REPORT" | "SOCIAL" | "INTERNAL";
export const INFOGRAPHIC_PROFILES: readonly InfographicProfile[] = ["SNAPSHOT", "DONOR_REPORT", "SOCIAL", "INTERNAL"];

/** Where a headline number comes from. MANUAL values must name their source (the Design check says so). */
export type BigNumberSource = "MANUAL" | "INDICATOR" | "REACH_UNIQUE" | "REACH_REGISTERED" | "ACTIVITIES_DONE" | "ACTIVITIES_PLANNED" | "FINANCE_BUDGET" | "FINANCE_EXPENDITURE" | "FINANCE_BALANCE" | "PORTFOLIO_PROJECTS" | "PORTFOLIO_COUNTRIES" | "PORTFOLIO_OFF_TRACK" | "PORTFOLIO_AT_RISK" | "PORTFOLIO_OPEN_RISKS" | "PORTFOLIO_REPORTS_OVERDUE";
export const BIG_NUMBER_SOURCES: readonly BigNumberSource[] = ["MANUAL", "INDICATOR", "REACH_UNIQUE", "REACH_REGISTERED", "ACTIVITIES_DONE", "ACTIVITIES_PLANNED", "FINANCE_BUDGET", "FINANCE_EXPENDITURE", "FINANCE_BALANCE", "PORTFOLIO_PROJECTS", "PORTFOLIO_COUNTRIES", "PORTFOLIO_OFF_TRACK", "PORTFOLIO_AT_RISK", "PORTFOLIO_OPEN_RISKS", "PORTFOLIO_REPORTS_OVERDUE"];

export interface BigNumberItem {
  label: string;
  source: BigNumberSource;
  /** MANUAL only: the figure as written ("1.2 million", "63%"). */
  value?: string;
  /** INDICATOR only. */
  indicatorId?: string;
  unit?: string;
  iconId?: string;
  caption?: string;
  /** Who said so (required for a MANUAL figure before a donor-ready design). */
  sourceNote?: string;
}

export interface FunnelStage {
  label: string;
  /** A figure someone supplied (people in need, people targeted). */
  value?: number;
  /** Or a figure the records give. */
  bind?: "REACH_UNIQUE" | "REACH_REGISTERED";
  sourceNote?: string;
}

export interface KeyMessage {
  text: string;
  iconId?: string;
}

export interface TimelineEvent {
  /** `YYYY-MM-DD`. */
  date: string;
  label: string;
  detail?: string;
}

export interface SectorCard {
  label: string;
  iconId?: string;
  indicatorIds: string[];
}

/** What a map block shades its first-level areas by (the pins are always drawn). */
export type MapMetric = "NONE" | "REACH" | "ACTIVITIES_DONE" | "ACTIVITIES_PLANNED";
export const MAP_METRICS: readonly MapMetric[] = ["NONE", "REACH", "ACTIVITIES_DONE", "ACTIVITIES_PLANNED"];

/** One row of an authored "who does what, where" matrix. */
export interface PresenceRow {
  who: string;
  what: string;
  /** Place names as typed; grouped by the product's one location normalizer. */
  where: string[];
}

/** What a design covers: one project, or every project the person can see (a portfolio page). */
export type DesignScope = "PROJECT" | "PORTFOLIO";
export const PORTFOLIO_PROJECT_ID = "portfolio";

export interface WaivedRule {
  ruleId: string;
  note: string;
}

/** The chart a CHART section draws: the Data Center's own spec, so preview and export agree. */
export interface InfographicChartSpec {
  template: DataChartTemplate;
  indicatorIds: string[];
  measure: ChartMeasure;
  type: ChartType;
  /** Draw the indicator's target as a reference line (over-time charts of one indicator). */
  showTarget?: boolean;
  title?: string;
}

export type SectionSize = "THIRD" | "HALF" | "FULL";

export interface InfographicSectionConfig {
  kind: InfographicSectionKind;
  /** Authored heading; absent = the section's default label. */
  title?: string;
  /** Authored body, TEXT sections only. */
  text?: string;
  /** CHART sections only. */
  chart?: InfographicChartSpec;
  /** Indicators a KPIS or LOCATION_RESULTS section covers (absent = the template's default set). */
  indicatorIds?: string[];
  /** Restrict to these location keys (absent/empty = all recorded locations). */
  locationKeys?: string[];
  /** Legacy width (THIRD/HALF/FULL); `span` wins when both are given. */
  size?: SectionSize;
  /** Grid columns of 12 (3, 4, 6, 8, 9 or 12). */
  span?: number;
  hidden?: boolean;
  /** Start a new page (print formats) / row before this section. */
  pageBreakBefore?: boolean;
  iconId?: string;
  numbers?: BigNumberItem[];
  stages?: FunnelStage[];
  messages?: KeyMessage[];
  events?: TimelineEvent[];
  sectors?: SectorCard[];
  /** QUOTE: who said it. */
  attribution?: string;
  /** IMAGE / HERO: an uploaded asset. */
  assetId?: string;
  caption?: string;
  credit?: string;
  altText?: string;
  /** The person shown agreed to appear (required for an IMAGE or a photo QUOTE before publishing). */
  consentConfirmed?: boolean;
  fit?: "COVER" | "CONTAIN";
  /** LEGEND_NOTES lines. */
  notes?: string[];
  rounding?: InfographicRounding;
  /** MAP: shade the first-level areas by this figure (choropleth). */
  mapMetric?: MapMetric;
  /** THREE_W: who does what, where (typed by the author; the source goes in `caption`). */
  presence?: PresenceRow[];
}

export interface InfographicConfig {
  templateId: string;
  templateVersion: number;
  /** Authored design title (the list page's name); absent = the template label. */
  title?: string;
  periodFromId?: string;
  periodToId?: string;
  locationKeys?: string[];
  branding?: boolean;
  /** Visual theme (Phase 32); absent = `DEFAULT`, the look of every design made before themes existed. */
  themeId?: string;
  /** When a report for a period is approved, prepare a fresh draft of this design for that period (never changes this one). */
  autoRefresh?: boolean;
  /** What the design covers; absent = one project. A portfolio design reads every project the person can see. */
  scope?: DesignScope;
  /** Page format (Phase 32); absent = A4 portrait. */
  format?: string;
  /** What the design is for (Design-check profile); absent = INTERNAL. */
  profile?: InfographicProfile;
  /** Language of the fixed words on the page; absent = English. */
  language?: string;
  subtitle?: string;
  /** Print the map disclaimer under any map (default true). */
  mapDisclaimer?: boolean;
  /** Design-check rules the author chose to waive, each with a reason. */
  waivers?: WaivedRule[];
  /** Uploaded donor/partner logos for the header or footer (up to 3). */
  donorLogoAssetIds?: string[];
  acknowledgement?: string;
  coverAssetId?: string;
  sections: InfographicSectionConfig[];
}

export const MAX_TITLE_LENGTH = 120;
export const MAX_TEXT_LENGTH = 600;
export const MAX_SHORT_TEXT = 160;
export const MAX_SECTIONS = 40;
export const MAX_INDICATORS_PER_SECTION = 30;

const cleanText = (value: string | undefined, max: number): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? undefined : trimmed;
};

type Fail = { ok: false; error: DomainError };
const fail = (message: string): Fail => ({ ok: false, error: DomainError.validation(message) });

/** Trims an optional authored text; `undefined` when empty. A too-long text is reported by the caller (never truncated). */
const tooLong = (value: string | undefined, max: number): boolean => Boolean(value?.trim()) && (value?.trim().length ?? 0) > max;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** The blocks a portfolio design may hold: portfolio figures, the map, and what a person types or uploads. */
export const PORTFOLIO_KINDS: ReadonlySet<string> = new Set(["HERO", "BIG_NUMBERS", "KEY_MESSAGES", "QUOTE", "BANNER", "TEXT", "IMAGE", "TIMELINE", "LEGEND_NOTES", "DIVIDER", "MAP", "PORTFOLIO_SUMMARY", "PORTFOLIO_TABLE", "PORTFOLIO_HEALTH", "PORTFOLIO_COUNTRIES"]);

const MAX_ITEMS = { numbers: 6, stages: 5, messages: 5, events: 12, sectors: 8, notes: 8 } as const;

/** Validates one section's own fields; returns the cleaned section or the first problem. */
function cleanSection(section: InfographicSectionConfig): { ok: true; value: InfographicSectionConfig } | Fail {
  if (!INFOGRAPHIC_SECTION_KINDS.includes(section.kind)) return fail("This design has a section of an unknown kind");
  const sectionTitle = cleanText(section.title, MAX_TITLE_LENGTH);
  if (tooLong(section.title, MAX_TITLE_LENGTH)) return fail(`Keep section titles under ${MAX_TITLE_LENGTH} characters`);
  const text = cleanText(section.text, MAX_TEXT_LENGTH);
  if (tooLong(section.text, MAX_TEXT_LENGTH)) return fail(`Keep section text under ${MAX_TEXT_LENGTH} characters`);
  // A TEXT section may start empty (template defaults do): the renderer shows its title and a blank panel.

  let chart: InfographicChartSpec | undefined;
  if (section.kind === "CHART") {
    if (!section.chart) return fail("A chart section needs a chart");
    const info = DATA_CHART_TEMPLATES[section.chart.template];
    if (!info) return fail("This chart template is not offered");
    if (!CHART_TYPES.includes(section.chart.type)) return fail("This chart type is not offered");
    if (!CHART_MEASURES.includes(section.chart.measure)) return fail("This chart measure is not offered");
    if (!info.types.includes(section.chart.type)) return fail(`A ${info.label} chart cannot be drawn as this chart type`);
    const ids = section.chart.indicatorIds ?? [];
    if (info.indicators === "none" && ids.length > 0) return fail(`A ${info.label} chart takes no indicators`);
    if (info.indicators === "one" && ids.length !== 1) return fail(`A ${info.label} chart needs exactly one indicator`);
    if (info.indicators === "many" && ids.length === 0) return fail(`A ${info.label} chart needs at least one indicator`);
    if (ids.length > MAX_INDICATORS_PER_SECTION) return fail(`A chart takes at most ${MAX_INDICATORS_PER_SECTION} indicators`);
    chart = {
      template: section.chart.template,
      indicatorIds: ids,
      measure: section.chart.measure,
      type: section.chart.type,
      ...(section.chart.showTarget ? { showTarget: true } : {}),
      ...(cleanText(section.chart.title, MAX_TITLE_LENGTH) ? { title: cleanText(section.chart.title, MAX_TITLE_LENGTH) } : {}),
    };
  }
  if (section.indicatorIds && section.indicatorIds.length > MAX_INDICATORS_PER_SECTION) return fail(`A section takes at most ${MAX_INDICATORS_PER_SECTION} indicators`);
  if (section.span !== undefined && !(GRID_SPANS as readonly number[]).includes(section.span)) return fail("Choose a width of 3, 4, 6, 8, 9 or 12 columns");
  if (section.iconId && !iconById(section.iconId)) return fail("Choose one of the offered icons");
  if (section.rounding && !INFOGRAPHIC_ROUNDINGS.includes(section.rounding)) return fail("Choose one of the offered rounding rules");
  if (section.fit && section.fit !== "COVER" && section.fit !== "CONTAIN") return fail("Choose how the image fits");
  if (section.mapMetric && !MAP_METRICS.includes(section.mapMetric)) return fail("Choose one of the offered map shadings");

  let numbers: BigNumberItem[] | undefined;
  if (section.numbers?.length) {
    if (section.numbers.length > MAX_ITEMS.numbers) return fail(`Show at most ${MAX_ITEMS.numbers} figures in one row`);
    numbers = [];
    for (const item of section.numbers) {
      if (!BIG_NUMBER_SOURCES.includes(item.source)) return fail("A figure has an unknown source");
      if (tooLong(item.label, 60) || tooLong(item.value, 24) || tooLong(item.unit, 16) || tooLong(item.caption, 80) || tooLong(item.sourceNote, 80)) return fail("A figure's text is too long");
      if (item.iconId && !iconById(item.iconId)) return fail("Choose one of the offered icons");
      if (item.source === "INDICATOR" && !item.indicatorId) return fail("Choose the indicator for this figure");
      numbers.push({
        label: item.label.trim(),
        source: item.source,
        ...(item.source === "MANUAL" && item.value?.trim() ? { value: item.value.trim() } : {}),
        ...(item.source === "INDICATOR" && item.indicatorId ? { indicatorId: item.indicatorId } : {}),
        ...(cleanText(item.unit, 16) ? { unit: cleanText(item.unit, 16) } : {}),
        ...(item.iconId ? { iconId: item.iconId } : {}),
        ...(cleanText(item.caption, 80) ? { caption: cleanText(item.caption, 80) } : {}),
        ...(cleanText(item.sourceNote, 80) ? { sourceNote: cleanText(item.sourceNote, 80) } : {}),
      });
    }
  }

  let stages: FunnelStage[] | undefined;
  if (section.stages?.length) {
    if (section.stages.length > MAX_ITEMS.stages) return fail(`A funnel has at most ${MAX_ITEMS.stages} stages`);
    stages = [];
    for (const stage of section.stages) {
      if (tooLong(stage.label, 40) || tooLong(stage.sourceNote, 80)) return fail("A funnel stage's text is too long");
      if (stage.value !== undefined && (!Number.isFinite(stage.value) || stage.value < 0 || stage.value > 1e10)) return fail("A funnel figure must be zero or more");
      if (stage.bind && stage.bind !== "REACH_UNIQUE" && stage.bind !== "REACH_REGISTERED") return fail("A funnel stage has an unknown source");
      stages.push({
        label: stage.label.trim(),
        ...(stage.bind ? { bind: stage.bind } : stage.value !== undefined ? { value: Math.round(stage.value) } : {}),
        ...(cleanText(stage.sourceNote, 80) ? { sourceNote: cleanText(stage.sourceNote, 80) } : {}),
      });
    }
  }

  let messages: KeyMessage[] | undefined;
  if (section.messages?.length) {
    if (section.messages.length > MAX_ITEMS.messages) return fail(`Keep to ${MAX_ITEMS.messages} key messages`);
    messages = [];
    for (const message of section.messages) {
      if (tooLong(message.text, MAX_SHORT_TEXT)) return fail(`Keep each key message under ${MAX_SHORT_TEXT} characters`);
      if (message.iconId && !iconById(message.iconId)) return fail("Choose one of the offered icons");
      const t = cleanText(message.text, MAX_SHORT_TEXT);
      if (t) messages.push({ text: t, ...(message.iconId ? { iconId: message.iconId } : {}) });
    }
  }

  let events: TimelineEvent[] | undefined;
  if (section.events?.length) {
    if (section.events.length > MAX_ITEMS.events) return fail(`A timeline has at most ${MAX_ITEMS.events} events`);
    events = [];
    for (const event of section.events) {
      if (!isRealDate(event.date)) return fail("A timeline event needs a real date");
      if (tooLong(event.label, 80) || tooLong(event.detail, MAX_SHORT_TEXT)) return fail("A timeline event's text is too long");
      events.push({ date: event.date, label: event.label.trim(), ...(cleanText(event.detail, MAX_SHORT_TEXT) ? { detail: cleanText(event.detail, MAX_SHORT_TEXT) } : {}) });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
  }

  let sectors: SectorCard[] | undefined;
  if (section.sectors?.length) {
    if (section.sectors.length > MAX_ITEMS.sectors) return fail(`A sector grid has at most ${MAX_ITEMS.sectors} cards`);
    sectors = [];
    for (const card of section.sectors) {
      if (tooLong(card.label, 40)) return fail("A sector name is too long");
      if (card.iconId && !iconById(card.iconId)) return fail("Choose one of the offered icons");
      if ((card.indicatorIds ?? []).length > 4) return fail("A sector card shows at most 4 indicators");
      sectors.push({ label: card.label.trim(), ...(card.iconId ? { iconId: card.iconId } : {}), indicatorIds: [...(card.indicatorIds ?? [])] });
    }
  }

  let presence: PresenceRow[] | undefined;
  if (section.presence?.length) {
    if (section.presence.length > 16) return fail("A who-does-what-where matrix has at most 16 rows");
    presence = [];
    for (const row of section.presence) {
      if (tooLong(row.who, 60) || tooLong(row.what, 60)) return fail("A name or an activity in the matrix is too long");
      if ((row.where ?? []).length > 8 || (row.where ?? []).some((w) => tooLong(w, 60))) return fail("A row names at most 8 places, each under 60 characters");
      const who = row.who.trim();
      if (!who) continue;
      presence.push({ who, what: row.what.trim(), where: [...new Set((row.where ?? []).map((w) => w.trim()).filter(Boolean))] });
    }
  }

  let notes: string[] | undefined;
  if (section.notes?.length) {
    if (section.notes.length > MAX_ITEMS.notes) return fail(`Keep to ${MAX_ITEMS.notes} notes`);
    notes = [];
    for (const line of section.notes) {
      if (tooLong(line, 200)) return fail("Keep each note under 200 characters");
      const t = cleanText(line, 200);
      if (t) notes.push(t);
    }
  }
  if (tooLong(section.attribution, 80) || tooLong(section.caption, 160) || tooLong(section.credit, 80) || tooLong(section.altText, 200)) return fail("An image or quote text is too long");

  return {
    ok: true,
    value: {
      kind: section.kind,
      ...(sectionTitle ? { title: sectionTitle } : {}),
      ...(text ? { text } : {}),
      ...(chart ? { chart } : {}),
      ...(section.indicatorIds?.length ? { indicatorIds: [...section.indicatorIds] } : {}),
      ...(section.locationKeys?.length ? { locationKeys: [...section.locationKeys] } : {}),
      ...(section.size ? { size: section.size } : {}),
      ...(section.span !== undefined ? { span: section.span } : {}),
      ...(section.hidden ? { hidden: true } : {}),
      ...(section.pageBreakBefore ? { pageBreakBefore: true } : {}),
      ...(section.iconId ? { iconId: section.iconId } : {}),
      ...(numbers?.length ? { numbers } : {}),
      ...(stages?.length ? { stages } : {}),
      ...(messages?.length ? { messages } : {}),
      ...(events?.length ? { events } : {}),
      ...(sectors?.length ? { sectors } : {}),
      ...(cleanText(section.attribution, 80) ? { attribution: cleanText(section.attribution, 80) } : {}),
      ...(section.assetId ? { assetId: section.assetId } : {}),
      ...(cleanText(section.caption, 160) ? { caption: cleanText(section.caption, 160) } : {}),
      ...(cleanText(section.credit, 80) ? { credit: cleanText(section.credit, 80) } : {}),
      ...(cleanText(section.altText, 200) ? { altText: cleanText(section.altText, 200) } : {}),
      ...(section.consentConfirmed ? { consentConfirmed: true } : {}),
      ...(section.fit ? { fit: section.fit } : {}),
      ...(notes?.length ? { notes } : {}),
      ...(presence?.length ? { presence } : {}),
      ...(section.rounding && section.rounding !== "NONE" ? { rounding: section.rounding } : {}),
      ...(section.mapMetric && section.mapMetric !== "NONE" ? { mapMetric: section.mapMetric } : {}),
    },
  };
}

/** The columns a section takes: its span, else the span its legacy size meant, else full width. */
export function spanOf(section: Pick<InfographicSectionConfig, "span" | "size">): number {
  if (section.span !== undefined) return section.span;
  return section.size ? SIZE_TO_SPAN[section.size] : 12;
}

/**
 * Validates a config against the template registry the caller trusts. Returns the cleaned config
 * (trimmed texts, defaults applied) or one error naming the first problem.
 */
export function validateConfig(
  input: InfographicConfig,
  knownTemplates: ReadonlyMap<string, { version: number }>,
): Result<InfographicConfig, DomainError> {
  const template = knownTemplates.get(input.templateId);
  if (!template) return fail("Choose one of the offered templates");
  if (input.templateVersion !== template.version) {
    return { ok: false, error: DomainError.validation("This design was made with another template version — recreate it or update the template version", { templateId: input.templateId, expected: template.version, got: input.templateVersion }) };
  }
  const title = cleanText(input.title, MAX_TITLE_LENGTH);
  if (tooLong(input.title, MAX_TITLE_LENGTH)) return fail(`Keep the title under ${MAX_TITLE_LENGTH} characters`);
  if (!Array.isArray(input.sections) || input.sections.length === 0) return fail("A design needs at least one section");
  if (input.sections.length > MAX_SECTIONS) return fail(`A design holds at most ${MAX_SECTIONS} sections`);
  if (input.themeId !== undefined && !themeById(input.themeId) && input.themeId !== "BRAND") return fail("Choose one of the offered themes");
  if (input.format !== undefined && !formatById(input.format)) return fail("Choose one of the offered page formats");
  if (input.profile !== undefined && !INFOGRAPHIC_PROFILES.includes(input.profile)) return fail("Choose one of the offered design profiles");
  if (input.language !== undefined && !INFOGRAPHIC_LANGUAGES.includes(input.language as never)) return fail("Choose one of the offered languages");
  if (tooLong(input.subtitle, 160) || tooLong(input.acknowledgement, 200)) return fail("A heading or acknowledgement is too long");
  if ((input.donorLogoAssetIds?.length ?? 0) > 3) return fail("Show at most 3 partner logos");
  if ((input.waivers?.length ?? 0) > 20) return fail("Too many waived checks");
  for (const waiver of input.waivers ?? []) {
    if (!waiver.ruleId || !waiver.note?.trim()) return fail("A waived check needs a reason");
    if (waiver.note.trim().length > 200) return fail("Keep a waiver reason under 200 characters");
  }
  if (input.scope !== undefined && input.scope !== "PROJECT" && input.scope !== "PORTFOLIO") return fail("Choose what the design covers");
  const sections: InfographicSectionConfig[] = [];
  for (const section of input.sections) {
    const cleaned = cleanSection(section);
    if (!cleaned.ok) return cleaned;
    const portfolioKind = section.kind.startsWith("PORTFOLIO_");
    if (portfolioKind && input.scope !== "PORTFOLIO") return fail("Portfolio blocks belong in a portfolio design");
    if (input.scope === "PORTFOLIO" && !PORTFOLIO_KINDS.has(section.kind)) return fail("A portfolio design uses portfolio blocks, a map, and text, pictures or timelines; blocks about one project's records belong in that project's design");
    sections.push(cleaned.value);
  }
  return {
    ok: true,
    value: {
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      ...(title ? { title } : {}),
      ...(input.periodFromId ? { periodFromId: input.periodFromId } : {}),
      ...(input.periodToId ? { periodToId: input.periodToId } : {}),
      ...(input.locationKeys?.length ? { locationKeys: [...input.locationKeys] } : {}),
      ...(input.branding ? { branding: true } : {}),
      ...(input.scope === "PORTFOLIO" ? { scope: "PORTFOLIO" as const } : {}),
      ...(input.autoRefresh && input.scope !== "PORTFOLIO" ? { autoRefresh: true } : {}),
      ...(input.themeId ? { themeId: input.themeId } : {}),
      ...(input.format ? { format: input.format } : {}),
      ...(input.profile ? { profile: input.profile } : {}),
      ...(input.language && input.language !== "en" ? { language: input.language } : {}),
      ...(cleanText(input.subtitle, 160) ? { subtitle: cleanText(input.subtitle, 160) } : {}),
      ...(input.mapDisclaimer === false ? { mapDisclaimer: false } : {}),
      ...(input.waivers?.length ? { waivers: input.waivers.map((w) => ({ ruleId: w.ruleId, note: w.note.trim() })) } : {}),
      ...(input.donorLogoAssetIds?.length ? { donorLogoAssetIds: [...input.donorLogoAssetIds] } : {}),
      ...(cleanText(input.acknowledgement, 200) ? { acknowledgement: cleanText(input.acknowledgement, 200) } : {}),
      ...(input.coverAssetId ? { coverAssetId: input.coverAssetId } : {}),
      sections,
    },
  };
}
