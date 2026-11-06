/**
 * The JSON Schema of each area's reply (extraction audit B3), sent to a provider that can enforce it; the prompts still state
 * the same shape for those that cannot. Every field is required and nullable, so "not stated" is always an explicit null.
 */
type Schema = Record<string, unknown>;

const str: Schema = { type: "string" };
const int: Schema = { type: "integer" };
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });
const obj = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const list = (items: Schema): Schema => ({ type: "array", items });
const CONFIDENCE: Schema = { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] };
const meta = { quote: str, block: int, confidence: CONFIDENCE };
const texts = (...keys: string[]): Record<string, Schema> => Object.fromEntries(keys.map((k) => [k, nullable(str)]));
const items = (key: string, fields: Record<string, Schema>): Schema => obj({ [key]: list(obj({ ...fields, ...meta })) });

export const LOGFRAME_SCHEMA = items("logframe", { level: { type: "string", enum: ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] }, title: str, ...texts("code", "description", "parentCode") });
export const STRUCTURE_SCHEMA = obj({ items: list(obj({ i: int, level: { type: "string", enum: ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] }, parent: nullable(int) })) });
export const INDICATORS_SCHEMA = items("indicators", { title: str, disaggregation: nullable(list(str)), ...texts("code", "logframeCode", "type", "unit", "baseline", "target", "targetSchedule", "frequency", "direction", "meansOfVerification") });
export const PLAN_SCHEMA = items("plan", { title: str, ...texts("logframeCode", "start", "end", "location", "lead") });
export const PLACES_SCHEMA = items("places", { name: str, adminLevel: nullable(int), parentName: nullable(str), latitude: nullable({ type: "number" }), longitude: nullable({ type: "number" }) });
export const FUNDING_BUDGET_SCHEMA = obj({
  funding: list(obj({ ...texts("sourceName", "amount", "currency"), ...meta })),
  budget: list(obj({ category: str, ...texts("amount", "currency", "logframeCode"), ...meta })),
});
const fact = (value: Schema): Schema => nullable(obj({ value, ...meta }));
export const FACTS_SCHEMA = obj({
  name: fact(str), code: fact(str), donor: fact(str), countries: fact(list(str)), sectors: fact(list(str)),
  startDate: fact(str), endDate: fact(str), currency: fact(str), summary: fact(str),
});
export const PERIODS_SCHEMA = items("periods", { type: { type: "string", enum: ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"] }, ...texts("start", "end") });
export const RISKS_SCHEMA = items("risks", { title: str, ...texts("kind", "seriousness", "mitigation") });
