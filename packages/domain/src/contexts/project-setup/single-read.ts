/**
 * The single-read reply (one model call over the whole document) turned into the per-area fields the existing grounding,
 * review and apply already use. Pure: no model, no clock. A value the reply does not state is `null` ("Not stated"); an
 * item that cannot be understood is skipped, never guessed. Quotes are kept as the model gave them: `groundAreaPatch` is
 * the one check that decides whether a quote supports its value.
 */
import type { SetupAreaKey } from "./proposal-areas.js";
import type { Proposed, SetupConfidence } from "./proposal.js";

export const SINGLE_READ_VERSION = "single-read-v1";

type Json = Record<string, unknown>;

const LOG_LEVELS = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] as const;
const PERIOD_TYPES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"] as const;
const BUDGET_KINDS = ["LINE", "DETAIL", "TOTAL"] as const;
const RISK_KINDS = ["RISK", "ASSUMPTION"] as const;
const SERIOUSNESS = ["LOW", "MEDIUM", "HIGH"] as const;

const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Json => x !== null) : []);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const amount = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) ? String(v) : text(v));
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (allowed as readonly string[]).includes(v as string) ? (v as T) : null;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter((x): x is string => x !== null) : []);

/** A stated value with its quote; a null value is "Not stated" and carries no quote. */
function node<T>(value: T | null, quote: string | null): Proposed<T> {
  if (value === null) return { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" };
  return { value, sourceQuote: quote, sourceRef: null, confidence: "MEDIUM" as SetupConfidence, status: "PROPOSED" };
}

/** One list item: its fields are the value, its own `quote` the citation. An item without any value is skipped. */
function item<T>(raw: Json, value: T | null): Proposed<T> | null {
  return value === null ? null : node(value, text(raw.quote));
}

const items = <T>(raw: unknown, make: (r: Json) => Proposed<T> | null): Proposed<T>[] =>
  list(raw).map(make).filter((x): x is Proposed<T> => x !== null);

function facts(raw: unknown): Json {
  const f = obj(raw) ?? {};
  const scalar = (key: string) => {
    const n = obj(f[key]);
    return node<string>(text(n?.value), text(n?.quote));
  };
  const multi = (key: string) => {
    const n = obj(f[key]);
    const values = strings(n?.value);
    return node<string[]>(values.length > 0 ? values : null, text(n?.quote));
  };
  return {
    name: scalar("name"), code: scalar("code"), donor: scalar("donor"),
    countries: multi("countries"), sectors: multi("sectors"),
    startDate: scalar("startDate"), endDate: scalar("endDate"), currency: scalar("currency"), summary: scalar("summary"),
  };
}

const logframe = (raw: unknown) => items(raw, (r) => {
  const level = oneOf(r.level, LOG_LEVELS);
  const title = text(r.title);
  return level && title ? item(r, { level, code: text(r.code), title, description: null, parentCode: text(r.parentCode) }) : null;
});

const indicators = (raw: unknown) => items(raw, (r) => {
  const title = text(r.title);
  if (!title) return null;
  return item(r, {
    code: text(r.code), title, logframeCode: text(r.logframeCode), type: text(r.type), unit: text(r.unit),
    baseline: text(r.baseline), target: text(r.target), targetSchedule: null, frequency: text(r.frequency),
    direction: text(r.direction), disaggregation: strings(r.disaggregation), meansOfVerification: null,
  });
});

const periods = (raw: unknown) => items(raw, (r) => {
  const type = oneOf(r.type, PERIOD_TYPES);
  return type ? item(r, { type, start: text(r.start), end: text(r.end) }) : null;
});

const plan = (raw: unknown) => items(raw, (r) => {
  const title = text(r.title);
  return title ? item(r, { title, logframeCode: text(r.logframeCode), start: text(r.start), end: text(r.end), location: text(r.location), lead: null }) : null;
});

const places = (raw: unknown) => items(raw, (r) => {
  const name = text(r.name);
  const adminLevel = typeof r.adminLevel === "number" && Number.isInteger(r.adminLevel) && r.adminLevel >= 0 && r.adminLevel <= 4 ? r.adminLevel : null;
  return name ? item(r, { name, adminLevel, parentName: text(r.parentName), latitude: null, longitude: null }) : null;
});

const funding = (raw: unknown) => items(raw, (r) => {
  const sourceName = text(r.sourceName);
  return sourceName ? item(r, { sourceName, amount: amount(r.amount), currency: text(r.currency) }) : null;
});

const budget = (raw: unknown) => items(raw, (r) => {
  const category = text(r.category);
  return category ? item(r, { category, amount: amount(r.amount), currency: text(r.currency), logframeCode: text(r.logframeCode), kind: oneOf(r.kind, BUDGET_KINDS) ?? "LINE" }) : null;
});

const risks = (raw: unknown) => items(raw, (r) => {
  const title = text(r.title);
  return title ? item(r, { kind: oneOf(r.kind, RISK_KINDS) ?? "RISK", title, seriousness: oneOf(r.seriousness, SERIOUSNESS), mitigation: text(r.mitigation) }) : null;
});

/**
 * The reply's fields for every area, keyed by area then by the proposal fields that area owns. A reply that is not an
 * object gives empty fields everywhere (nothing invented); every area is always present so a missing part is "not stated".
 */
export function singleReadFields(reply: unknown): Record<SetupAreaKey, Json> {
  const r = obj(reply) ?? {};
  return {
    FACTS: { facts: facts(r.facts) },
    LOGFRAME: { logframe: logframe(r.logframe) },
    INDICATORS: { indicators: indicators(r.indicators) },
    PERIODS: { periods: periods(r.periods) },
    PLAN: { plan: plan(r.plan) },
    PLACES: { places: places(r.places) },
    FUNDING_BUDGET: { funding: funding(r.funding), budget: budget(r.budget) },
    RISKS: { risks: risks(r.risks) },
  };
}
