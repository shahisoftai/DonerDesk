/**
 * Parameters (Phase 48.3): named choices a viewer makes (a period, a place, a group, a status, an indicator, a project, a word) that blocks
 * read. A parameter is part of the canvas's design; what a viewer picks is never saved. The four built-in cross-filters (period, place,
 * group, status) are parameters too: a click on a chart label sets one. Pure: validation, defaults, and the filter a block receives.
 */
export const PARAMETER_KINDS = ["PERIOD", "PERIOD_RANGE", "PLACE", "GROUP", "STATUS", "INDICATOR", "PROJECT", "TEXT"] as const;
export type ParameterKind = (typeof PARAMETER_KINDS)[number];

export type ParamValue = string | string[] | { from: string; to: string } | null;

export interface CanvasParameter {
  id: string;
  label: string;
  kind: ParameterKind;
  /** The value used until the viewer chooses; absent = no choice (everything). */
  default?: ParamValue | undefined;
  /** Offered values; absent = the values the data has (the screen asks for them). A TEXT parameter has none. */
  allowed?: string[] | undefined;
  /** More than one value at once (places, groups, statuses, indicators). */
  multiple?: boolean | undefined;
  /** The page the parameter belongs to; absent = the whole canvas. */
  pageId?: string | undefined;
}

/** What a block reads a parameter as. A PERIOD parameter feeds the block's period; a PERIOD_RANGE its range; and so on. */
export const PARAM_TARGETS = ["period", "periodRange", "place", "group", "status", "indicator", "project", "text"] as const;
export type ParamTarget = (typeof PARAM_TARGETS)[number];
export interface ParamBinding { param: string; target: ParamTarget }

/** How each kind of parameter behaves: one table, so nothing branches on a kind's name. */
interface ParameterKindRule {
  target: ParamTarget;
  /** Several values at once (places, groups, statuses, indicators). */
  multi: boolean;
  /** A list of offered values makes sense (a word typed freely or a range of periods has none). */
  offersList: boolean;
  /** The value's shape. */
  fits: (v: Exclude<ParamValue, null>) => boolean;
}
export const MAX_PARAMETERS = 20;
export const MAX_TEXT_PARAM = 100;
const oneOrMany = (v: Exclude<ParamValue, null>) => (Array.isArray(v) ? v.every((x) => typeof x === "string") : typeof v === "string");
const one = (v: Exclude<ParamValue, null>) => typeof v === "string";
const PARAMETER_KIND_RULES: Readonly<Record<ParameterKind, ParameterKindRule>> = {
  PERIOD: { target: "period", multi: false, offersList: true, fits: one },
  PERIOD_RANGE: { target: "periodRange", multi: false, offersList: false, fits: (v) => typeof v === "object" && !Array.isArray(v) && typeof v.from === "string" && typeof v.to === "string" },
  PLACE: { target: "place", multi: true, offersList: true, fits: oneOrMany },
  GROUP: { target: "group", multi: true, offersList: true, fits: oneOrMany },
  STATUS: { target: "status", multi: true, offersList: true, fits: oneOrMany },
  INDICATOR: { target: "indicator", multi: true, offersList: true, fits: oneOrMany },
  PROJECT: { target: "project", multi: false, offersList: true, fits: one },
  TEXT: { target: "text", multi: false, offersList: false, fits: (v) => typeof v === "string" && v.length <= MAX_TEXT_PARAM },
};
export const targetFor = (kind: ParameterKind): ParamTarget => PARAMETER_KIND_RULES[kind].target;

export const isValueOfKind = (kind: ParameterKind, v: ParamValue): boolean => v === null || PARAMETER_KIND_RULES[kind].fits(v);

export interface ParamProblem { paramId: string; message: string }

export function parameterProblems(params: ReadonlyArray<CanvasParameter>, pageIds: ReadonlySet<string> = new Set()): ParamProblem[] {
  const out: ParamProblem[] = [];
  if (params.length > MAX_PARAMETERS) out.push({ paramId: "", message: `A canvas has at most ${MAX_PARAMETERS} parameters.` });
  const seen = new Set<string>();
  for (const p of params) {
    const at = (message: string) => out.push({ paramId: p.id, message });
    if (!/^[a-z][a-z0-9_]{0,29}$/i.test(p.id)) at("A parameter's name is 1 to 30 letters, digits or underscores, starting with a letter.");
    if (seen.has(p.id)) at("Two parameters share a name.");
    seen.add(p.id);
    if (!p.label.trim() || p.label.length > 60) at("A parameter's label is 1 to 60 characters.");
    if (!Object.hasOwn(PARAMETER_KIND_RULES, p.kind)) { at("Unknown kind of parameter."); continue; }
    if (p.default !== undefined && !isValueOfKind(p.kind, p.default)) at("The default does not fit this kind of parameter.");
    if (p.multiple && !PARAMETER_KIND_RULES[p.kind].multi) at("This kind of parameter takes one value.");
    if (p.allowed && !PARAMETER_KIND_RULES[p.kind].offersList) at("This kind of parameter has no list of values.");
    if (p.allowed && p.default && PARAMETER_KIND_RULES[p.kind].offersList) for (const v of Array.isArray(p.default) ? p.default : [p.default]) if (typeof v === "string" && !p.allowed.includes(v)) at("The default is not one of the offered values.");
    if (p.pageId && pageIds.size > 0 && !pageIds.has(p.pageId)) at("The parameter belongs to a page that does not exist.");
  }
  return out;
}

export function paramBindingProblems(bindings: ReadonlyArray<ParamBinding>, params: ReadonlyArray<CanvasParameter>): string[] {
  const out: string[] = [];
  for (const b of bindings) {
    const p = params.find((x) => x.id === b.param);
    if (!p) { out.push(`This block reads a parameter (${b.param}) that does not exist.`); continue; }
    if (!(PARAM_TARGETS as readonly string[]).includes(b.target)) out.push("Unknown way of reading a parameter.");
    else if (PARAMETER_KIND_RULES[p.kind].target !== b.target) out.push(`"${p.label}" is a ${p.kind.toLowerCase().replace("_", " ")} and cannot be read as a ${b.target}.`);
  }
  return out;
}

/** The values in force: the viewer's choice where it is valid, otherwise the default. An invalid choice (not an offered value, wrong shape) is ignored, never stored. */
export function effectiveValues(params: ReadonlyArray<CanvasParameter>, chosen: Readonly<Record<string, ParamValue | undefined>>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of params) {
    const pick = chosen[p.id];
    const valid = pick !== undefined && isValueOfKind(p.kind, pick) && (!p.allowed || !PARAMETER_KIND_RULES[p.kind].offersList || (Array.isArray(pick) ? pick : pick === null ? [] : [pick as string]).every((v) => p.allowed!.includes(v)));
    out[p.id] = valid ? (pick as ParamValue) : (p.default ?? null);
  }
  return out;
}

export interface BlockFilter { period?: string; periodRange?: { from: string; to: string }; places: string[]; group: string; status: string; indicators: string[]; project?: string; text: string }

/** What one block is asked for: only the parameters it declares it reads, so a block that reads nothing is never narrowed. */
export function filterFor(bindings: ReadonlyArray<ParamBinding> | undefined, values: Readonly<Record<string, ParamValue>>): BlockFilter {
  const f: BlockFilter = { places: [], group: "", status: "", indicators: [], text: "" };
  for (const b of bindings ?? []) {
    const v = values[b.param];
    if (v === null || v === undefined) continue;
    const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    if (b.target === "period" && typeof v === "string") f.period = v;
    else if (b.target === "periodRange" && typeof v === "object" && !Array.isArray(v)) f.periodRange = v;
    else if (b.target === "place") f.places = list;
    else if (b.target === "group") f.group = list[0] ?? "";
    else if (b.target === "status") f.status = list[0] ?? "";
    else if (b.target === "indicator") f.indicators = list;
    else if (b.target === "project" && typeof v === "string") f.project = v;
    else if (b.target === "text" && typeof v === "string") f.text = v;
  }
  return f;
}
