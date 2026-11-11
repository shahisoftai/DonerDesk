import { CHART_KINDS, kindsForTemplate } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { METRICS, TILE_COLORS, MAP_SHADINGS, MAP_VIEWS, MAP_COLOR_MODES, MAP_AREA_LABELS, PROJECT_LIST_AFFILIATIONS, COUNT_METRICS, MULTI_CARD_LAYOUTS } from "@donordesk/domain/contexts/dashboards/index.js";
import { BIG_NUMBER_SOURCES, INFOGRAPHIC_ICONS, SHAPE_NAMES, TONE_NAMES } from "@donordesk/domain/contexts/infographics/index.js";
import { FILTER_DIMENSIONS, FILTER_CONTROL_STYLES } from "@donordesk/domain/contexts/canvas/index.js";
import { getAt, setAt } from "./path.ts";

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

/** One figure of a figure card: an indicator, a count, or a money or activity figure. */
const CARD_ITEM: ReadonlyArray<Field> = [
  { type: "select", path: "source.kind", label: "What it is", options: [{ value: "INDICATOR", label: "An indicator" }, { value: "COUNT", label: "A count" }, { value: "TILE", label: "Money or activities" }] },
  { type: "indicator", path: "source.indicatorId", label: "Indicator (for an indicator)" },
  { type: "select", path: "source.measure", label: "Figure (for an indicator)", empty: "—", options: [{ value: "PERIOD", label: "Latest period" }, { value: "CUMULATIVE", label: "Total to date" }] },
  { type: "select", path: "source.metric", label: "Which (for a count, money or activities)", empty: "—", options: [...Object.entries(COUNT_METRICS).map(([value, m]) => ({ value, label: m.label })), ...Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))] },
  { type: "number", path: "source.level", label: "Level (places reached: 1 province, 2 district…)", min: 0, max: 4 },
  { type: "text", path: "source.facilityType", label: "Facility type (facilities: OTP, SC…)" },
  { type: "text", path: "label", label: "Label (empty = the usual name)" },
];

const AI_FIELDS: ReadonlyArray<Field> = [
  { type: "textarea", path: "text", label: "Text", hint: "Write it, or paste a draft from an assistant and tick Accepted once you have checked every figure." },
  { type: "boolean", path: "accepted", label: "Accepted: I checked this text" },
  { type: "textarea", path: "instruction", label: "Note on what this should say (optional)" },
];

export const PROP_FIELDS: Readonly<Record<string, ReadonlyArray<Field>>> = {
  TEXT: [{ type: "textarea", path: "text", label: "Text", hint: "A line starting with # is a heading." }],
  BANNER: [{ type: "text", path: "text", label: "Words on the banner" }],
  SHAPE: [{ type: "select", path: "shape", label: "Shape", options: opts(SHAPE_NAMES, words) }, { type: "select", path: "tone", label: "Colour", options: opts(TONE_NAMES, words) }, { type: "text", path: "label", label: "Description (leave empty if it only decorates)" }],
  ICON: [{ type: "select", path: "iconId", label: "Icon", options: INFOGRAPHIC_ICONS.map((i) => ({ value: i.id, label: i.label })) }, { type: "select", path: "tone", label: "Colour", options: opts(TONE_NAMES, words) }, { type: "text", path: "label", label: "Description (leave empty if it only decorates)" }],
  CALLOUT: [{ type: "textarea", path: "text", label: "Text" }, { type: "select", path: "tone", label: "Look", options: [{ value: "info", label: "Information" }, { value: "good", label: "Good news" }, { value: "warn", label: "Warning" }] }],
  HERO: [title, { type: "text", path: "text", label: "Subtitle" }, { type: "text", path: "assetId", label: "Cover picture id", hint: "The id of an image in the infographic library." }],
  KEY_MESSAGES: [title, { type: "list", path: "messages", label: "Messages", add: "Add a message", blank: { text: "" }, item: [{ type: "textarea", path: "text", label: "Message" }] }],
  QUOTE: [{ type: "textarea", path: "text", label: "Quotation" }, { type: "text", path: "attribution", label: "Who said it" }, { type: "boolean", path: "consentConfirmed", label: "The person agreed to be quoted" }],
  LEGEND_NOTES: [title, { type: "lines", path: "notes", label: "Notes", hint: "One note per line. The source line is added for you." }],
  IMAGE: [title, { type: "text", path: "assetId", label: "Image id", hint: "The id of an image in the infographic library." }, { type: "text", path: "altText", label: "Description for people who cannot see it" }, { type: "text", path: "caption", label: "Caption" }, { type: "text", path: "credit", label: "Photo credit" }, { type: "select", path: "fit", label: "Fit", options: [{ value: "COVER", label: "Fill the space" }, { value: "CONTAIN", label: "Show all of it" }] }, { type: "boolean", path: "consentConfirmed", label: "The people shown agreed to appear" }],
  TIMELINE: [title, { type: "list", path: "events", label: "Events", add: "Add an event", blank: { date: "", label: "" }, item: [{ type: "text", path: "date", label: "Date (YYYY-MM-DD)" }, { type: "text", path: "label", label: "What happened" }, { type: "text", path: "detail", label: "Detail" }] }],
  KPI: [{ type: "indicator", path: "indicatorId", label: "Indicator" }, { type: "boolean", path: "includeDraft", label: "Include values not yet verified" }, { type: "text", path: "title", label: "Name of the tile" }, { type: "select", path: "measure", label: "Figure shown", empty: "This period", options: [{ value: "CUMULATIVE", label: "Total to date" }] }, { type: "select", path: "color", label: "Colour", empty: "Plain", options: opts(TILE_COLORS, words) }],
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
  MULTI_CARD: [
    { type: "text", path: "header", label: "Heading inside the card", hint: "In a repeater over places, the place's name is used when this is empty." },
    { type: "select", path: "layout", label: "Layout", options: opts(MULTI_CARD_LAYOUTS, words) },
    { type: "number", path: "columns", label: "Columns (1 to 4)", min: 1, max: 4 },
    { type: "boolean", path: "includeDraft", label: "Include values not yet verified" },
    { type: "list", path: "items", label: "Figures", add: "Add a figure", blank: { source: { kind: "INDICATOR", indicatorId: "", measure: "PERIOD" } }, item: CARD_ITEM },
  ],
  MAP: [{ type: "select", path: "view", label: "Shows", options: opts(MAP_VIEWS, (v) => (v === "RESULTS" ? "Results by place" : "Where activities are")) }, { type: "select", path: "shading", label: "Shade areas by", empty: "Nothing", options: opts(MAP_SHADINGS.filter((s) => s !== "NONE"), words) }, { type: "text", path: "title", label: "Name of the map" }, { type: "indicator", path: "indicatorId", label: "Indicator it opens on (results map)" },
    { type: "select", path: "colorBy", label: "Colour areas by", empty: "The figure (scale)", options: opts(MAP_COLOR_MODES.filter((m) => m !== "VALUE"), (v) => ({ RULES: "Bands of the figure", CATEGORY: "Area (one colour each)", NONE: "Outlines only" })[v] ?? v) },
    { type: "number", path: "categoryLevel", label: "Areas at level (when coloured by area; 1 = province)", min: 0, max: 4 },
    { type: "list", path: "bands", label: "Bands (when coloured by bands), low to high", add: "Add a band", blank: { from: null, to: null, color: "#2563eb" }, item: [{ type: "number", path: "from", label: "From (empty = lowest)" }, { type: "number", path: "to", label: "Up to (empty = highest)" }, { type: "text", path: "color", label: "Colour (#rrggbb)" }] },
    { type: "select", path: "areaLabels", label: "Labels on areas", empty: "None", options: opts(MAP_AREA_LABELS.filter((l) => l !== "NONE"), (v) => ({ NAME: "Name", VALUE: "Figure", NAME_AND_VALUE: "Name and figure" })[v] ?? v) },
    { type: "boolean", path: "clickToFilter", label: "Clicking an area filters the page" },
    { type: "lines", path: "callouts.placeKeys", label: "Figure cards beside these areas (one place per line)" },
    { type: "number", path: "callouts.columns", label: "Columns in each card (1 to 3)", min: 1, max: 3 },
    { type: "list", path: "callouts.items", label: "Figures in each card", add: "Add a figure", blank: { source: { kind: "COUNT", metric: "PLACES_REACHED", level: 2 } }, item: CARD_ITEM }],
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
  REPEATER: [{ type: "select", path: "over", label: "Repeat over", options: [{ value: "PROJECT", label: "Projects" }, { value: "PLACE", label: "Places" }] }, { type: "number", path: "limit", label: "How many (1 to 12)", min: 1, max: 12 }],
  FILTER_BAR: [
    { type: "choices", path: "dimensions", label: "Filters to offer", options: FILTER_DIMENSIONS.map((value) => ({ value, label: words(value) })) },
    { type: "list", path: "controls", label: "How each filter looks", add: "Set a filter's look", blank: { dimension: "PLACE", style: "DROPDOWN", multi: true, search: true }, item: [
      { type: "select", path: "dimension", label: "Filter", options: FILTER_DIMENSIONS.map((value) => ({ value, label: words(value) })) },
      { type: "select", path: "style", label: "Looks like", options: opts(FILTER_CONTROL_STYLES, words) },
      { type: "boolean", path: "multi", label: "Several choices at once" },
      { type: "boolean", path: "search", label: "Search box" },
      { type: "boolean", path: "selectedFirst", label: "Chosen ones first" },
      { type: "text", path: "label", label: "Label" },
      { type: "lines", path: "levels", label: "Place levels, top first (for example 1 then 2: province then district)" },
    ] },
    { type: "boolean", path: "options.clearAll", label: "Offer Clear all" },
    { type: "boolean", path: "options.cascade", label: "Choices narrow each other" },
    { type: "boolean", path: "options.applyButton", label: "Apply only when Apply is pressed" },
    { type: "boolean", path: "options.syncPages", label: "Same choice on every page" },
  ],
};

/** After a setting changes, keep the rest of the block consistent: a chart of one indicator and a chart of several use different data shapes. */
/** A figure's source keeps only the settings its kind uses (a count has no indicator; an indicator has no metric). */
const SOURCE_KEYS: Readonly<Record<string, readonly string[]>> = { INDICATOR: ["kind", "indicatorId", "measure"], COUNT: ["kind", "metric", "level", "facilityType"], TILE: ["kind", "metric"] };
function tidyItems(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((it) => {
    const src = (it as { source?: Record<string, unknown> })?.source;
    if (!src || typeof src !== "object") return it;
    const keep = SOURCE_KEYS[String(src["kind"])] ?? ["kind"];
    const next: Record<string, unknown> = Object.fromEntries(Object.entries(src).filter(([k, v]) => keep.includes(k) && v !== undefined && v !== ""));
    if (next["kind"] === "INDICATOR" && !next["measure"]) next["measure"] = "PERIOD";
    return { ...(it as object), source: next };
  });
}
const toNumbers = (v: unknown): unknown => (Array.isArray(v) ? v.map((x) => Number(String(x).trim())).filter((n) => Number.isInteger(n)) : v);

const AFTER: Readonly<Record<string, (props: unknown, path: string) => unknown>> = {
  MULTI_CARD: (props, path) => (path === "items" ? setAt(props, "items", tidyItems(getAt(props, "items"))) : props),
  FILTER_BAR: (props, path) => {
    if (path !== "controls") return props;
    const controls = getAt(props, "controls");
    return Array.isArray(controls) ? setAt(props, "controls", controls.map((c) => (c && typeof c === "object" && "levels" in c ? { ...c, levels: toNumbers((c as { levels: unknown }).levels) } : c))) : props;
  },
  MAP: (props, path) => {
    if (path === "callouts.items") return setAt(props, "callouts.items", tidyItems(getAt(props, "callouts.items")));
    if (path === "bands") { const v = getAt(props, "bands"); return Array.isArray(v) ? setAt(props, "bands", v.map((b) => ({ ...(b as object), from: (b as { from?: number }).from ?? null, to: (b as { to?: number }).to ?? null }))) : props; }
    return props;
  },
  CHART: (props, path) => {
    if (path !== "spec.dataset.indicatorIds") return props;
    const ids = ((props as { spec: { dataset: { indicatorIds: string[] } } }).spec.dataset.indicatorIds ?? []).length;
    return setAt(props, "spec.dataset.template", ids > 1 ? "INDICATORS_OVER_TIME" : "INDICATOR_OVER_TIME");
  },
};
export const afterChange = (kind: string, props: unknown, path: string): unknown => AFTER[kind]?.(props, path) ?? props;
