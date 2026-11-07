import { CHART_KINDS, kindsForTemplate } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { METRICS, TILE_COLORS, MAP_SHADINGS, MAP_VIEWS, PROJECT_LIST_AFFILIATIONS } from "@donordesk/domain/contexts/dashboards/index.js";
import { BIG_NUMBER_SOURCES } from "@donordesk/domain/contexts/infographics/index.js";
import { FILTER_DIMENSIONS } from "@donordesk/domain/contexts/canvas/index.js";
import { setAt } from "./path.ts";

/**
 * The settings form of each kind of block, as data (Phase 45.3): the editor draws whatever a row says, and never names a kind. A field
 * has a dotted path into the block's settings. A kind with no row still has the "Advanced" JSON editor, so every block is editable.
 */
export type Field =
  | { type: "text" | "textarea"; path: string; label: string; hint?: string }
  | { type: "number"; path: string; label: string; min?: number; max?: number }
  | { type: "boolean"; path: string; label: string }
  | { type: "select"; path: string; label: string; options: ReadonlyArray<{ value: string; label: string }>; empty?: string }
  | { type: "indicator"; path: string; label: string }
  | { type: "indicators"; path: string; label: string }
  | { type: "choices"; path: string; label: string; options: ReadonlyArray<{ value: string; label: string }> }
  | { type: "lines"; path: string; label: string; hint?: string }
  | { type: "list"; path: string; label: string; add: string; item: ReadonlyArray<Field>; blank: Record<string, unknown> };

const opts = (values: readonly string[], label: (v: string) => string = (v) => v) => values.map((value) => ({ value, label: label(value) }));
const words = (v: string): string => v.toLowerCase().split("_").map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
const title: Field = { type: "text", path: "title", label: "Heading", hint: "Shown above the block. Leave empty for the usual one." };
const MEASURES = [{ value: "PERIOD", label: "This period" }, { value: "CUMULATIVE", label: "Cumulative" }, { value: "PERCENT_OF_TARGET", label: "% of target" }];
const CHART_KIND_OPTIONS = [...new Set([...kindsForTemplate("INDICATOR_OVER_TIME"), ...kindsForTemplate("INDICATORS_OVER_TIME")])].map((k) => ({ value: k, label: CHART_KINDS[k].label }));

const AI_FIELDS: ReadonlyArray<Field> = [
  { type: "textarea", path: "text", label: "Text", hint: "Write it, or paste a draft from an assistant and tick Accepted once you have checked every figure." },
  { type: "boolean", path: "accepted", label: "Accepted: I checked this text" },
  { type: "textarea", path: "instruction", label: "Note on what this should say (optional)" },
];

export const PROP_FIELDS: Readonly<Record<string, ReadonlyArray<Field>>> = {
  TEXT: [{ type: "textarea", path: "text", label: "Text", hint: "A line starting with # is a heading." }],
  BANNER: [{ type: "text", path: "text", label: "Words on the banner" }],
  CALLOUT: [{ type: "textarea", path: "text", label: "Text" }, { type: "select", path: "tone", label: "Look", options: [{ value: "info", label: "Information" }, { value: "good", label: "Good news" }, { value: "warn", label: "Warning" }] }],
  HERO: [title, { type: "text", path: "text", label: "Subtitle" }, { type: "text", path: "assetId", label: "Cover picture id", hint: "The id of an image in the infographic library." }],
  KEY_MESSAGES: [title, { type: "list", path: "messages", label: "Messages", add: "Add a message", blank: { text: "" }, item: [{ type: "textarea", path: "text", label: "Message" }] }],
  QUOTE: [{ type: "textarea", path: "text", label: "Quotation" }, { type: "text", path: "attribution", label: "Who said it" }, { type: "boolean", path: "consentConfirmed", label: "The person agreed to be quoted" }],
  LEGEND_NOTES: [title, { type: "lines", path: "notes", label: "Notes", hint: "One note per line. The source line is added for you." }],
  IMAGE: [title, { type: "text", path: "assetId", label: "Image id", hint: "The id of an image in the infographic library." }, { type: "text", path: "altText", label: "Description for people who cannot see it" }, { type: "text", path: "caption", label: "Caption" }, { type: "text", path: "credit", label: "Photo credit" }, { type: "select", path: "fit", label: "Fit", options: [{ value: "COVER", label: "Fill the space" }, { value: "CONTAIN", label: "Show all of it" }] }, { type: "boolean", path: "consentConfirmed", label: "The people shown agreed to appear" }],
  TIMELINE: [title, { type: "list", path: "events", label: "Events", add: "Add an event", blank: { date: "", label: "" }, item: [{ type: "text", path: "date", label: "Date (YYYY-MM-DD)" }, { type: "text", path: "label", label: "What happened" }, { type: "text", path: "detail", label: "Detail" }] }],
  KPI: [{ type: "indicator", path: "indicatorId", label: "Indicator" }, { type: "boolean", path: "includeDraft", label: "Include values not yet verified" }, { type: "text", path: "title", label: "Name of the tile" }, { type: "select", path: "color", label: "Colour", empty: "Plain", options: opts(TILE_COLORS, words) }],
  METRIC: [{ type: "select", path: "metric", label: "Figure", options: Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label })) }, { type: "text", path: "title", label: "Name of the tile" }, { type: "select", path: "color", label: "Colour", empty: "Usual for this figure", options: opts(TILE_COLORS, words) }],
  CHART: [
    { type: "select", path: "spec.kind", label: "Kind of chart", options: CHART_KIND_OPTIONS },
    { type: "indicators", path: "spec.dataset.indicatorIds", label: "Indicators" },
    { type: "select", path: "spec.dataset.measure", label: "Show", options: MEASURES },
    { type: "boolean", path: "spec.dataset.showTarget", label: "Draw the target" },
    { type: "boolean", path: "spec.dataset.includeDraft", label: "Include values not yet verified" },
    { type: "text", path: "spec.title", label: "Title" },
  ],
  TABLE: [
    { type: "indicators", path: "query.indicatorIds", label: "Indicators" },
    { type: "select", path: "query.rows", label: "Rows are", options: [{ value: "PERIOD", label: "Periods" }, { value: "INDICATOR", label: "Indicators" }] },
    { type: "select", path: "query.measure", label: "Show", options: MEASURES },
    { type: "boolean", path: "query.includeDraft", label: "Include values not yet verified" },
    { type: "text", path: "title", label: "Title" },
  ],
  MAP: [{ type: "select", path: "view", label: "Shows", options: opts(MAP_VIEWS, (v) => (v === "RESULTS" ? "Results by place" : "Where activities are")) }, { type: "select", path: "shading", label: "Shade areas by", empty: "Nothing", options: opts(MAP_SHADINGS.filter((s) => s !== "NONE"), words) }, { type: "text", path: "title", label: "Name of the map" }],
  PROJECT_LIST: [{ type: "select", path: "affiliation", label: "Projects", options: opts(PROJECT_LIST_AFFILIATIONS, words) }, { type: "text", path: "title", label: "Name of the list" }],
  BIG_NUMBERS: [title, { type: "list", path: "numbers", label: "Figures", add: "Add a figure", blank: { label: "", source: "REACH_UNIQUE" }, item: [{ type: "text", path: "label", label: "What it is" }, { type: "select", path: "source", label: "Where it comes from", options: opts(BIG_NUMBER_SOURCES, words) }, { type: "indicator", path: "indicatorId", label: "Indicator (when from an indicator)" }, { type: "text", path: "value", label: "Figure (when typed)" }, { type: "text", path: "sourceNote", label: "Source of a typed figure" }] }],
  PROGRESS_RINGS: [title, { type: "indicators", path: "indicatorIds", label: "Indicators (none = the first with a target)" }],
  FUNNEL: [title, { type: "list", path: "stages", label: "Stages", add: "Add a stage", blank: { label: "" }, item: [{ type: "text", path: "label", label: "Stage" }, { type: "number", path: "value", label: "Number (when known)", min: 0 }, { type: "select", path: "bind", label: "Or take it from the records", empty: "Use the number", options: [{ value: "REACH_UNIQUE", label: "People reached (unique)" }, { value: "REACH_REGISTERED", label: "People registered" }] }, { type: "text", path: "sourceNote", label: "Source of the number" }] }],
  SECTOR_GRID: [title, { type: "list", path: "sectors", label: "Sectors", add: "Add a sector", blank: { label: "", indicatorIds: [] }, item: [{ type: "text", path: "label", label: "Sector" }, { type: "indicators", path: "indicatorIds", label: "Indicators" }] }],
  THREE_W: [title, { type: "list", path: "presence", label: "Organisations", add: "Add an organisation", blank: { who: "", what: "", where: [] }, item: [{ type: "text", path: "who", label: "Who" }, { type: "text", path: "what", label: "Does what" }, { type: "lines", path: "where", label: "Where (one place per line)" }] }, { type: "text", path: "caption", label: "Source of this table" }],
  LOCATION_RESULTS: [title, { type: "indicators", path: "indicatorIds", label: "Indicators (none = all recorded by place)" }, { type: "lines", path: "locationKeys", label: "Only these places (one per line, lower case)" }],
  REACH: [title], ACTIVITIES_BY_LOCATION: [title], LOCATION_COMPARISON: [title], DEMOGRAPHICS: [title], FUNDING: [title],
  GROUP: [{ type: "text", path: "title", label: "Name" }],
  SMALL_MULTIPLES: [title, { type: "indicators", path: "indicatorIds", label: "Indicators (none = those with two or more recorded periods)" }],
  RESULTS_CHAIN: [title], PORTFOLIO_SUMMARY: [title], PORTFOLIO_TABLE: [title], PORTFOLIO_HEALTH: [title], PORTFOLIO_COUNTRIES: [title],
  AI_SUMMARY: AI_FIELDS, AI_MESSAGES: AI_FIELDS, AI_ASK: AI_FIELDS,
  TABS: [{ type: "lines", path: "titles", label: "Tabs (one title per line, 2 to 6)" }],
  REPEATER: [{ type: "select", path: "over", label: "Repeat over", options: [{ value: "PROJECT", label: "Projects" }, { value: "PLACE", label: "Places" }, { value: "SECTOR", label: "Sectors" }] }, { type: "number", path: "limit", label: "How many (1 to 12)", min: 1, max: 12 }],
  FILTER_BAR: [{ type: "choices", path: "dimensions", label: "Filters to offer", options: FILTER_DIMENSIONS.map((value) => ({ value, label: words(value) })) }],
};

/** After a setting changes, keep the rest of the block consistent: a chart of one indicator and a chart of several use different data shapes. */
const AFTER: Readonly<Record<string, (props: unknown, path: string) => unknown>> = {
  CHART: (props, path) => {
    if (path !== "spec.dataset.indicatorIds") return props;
    const ids = ((props as { spec: { dataset: { indicatorIds: string[] } } }).spec.dataset.indicatorIds ?? []).length;
    return setAt(props, "spec.dataset.template", ids > 1 ? "INDICATORS_OVER_TIME" : "INDICATOR_OVER_TIME");
  },
};
export const afterChange = (kind: string, props: unknown, path: string): unknown => AFTER[kind]?.(props, path) ?? props;
