/**
 * Checks that hold for every block model (Phase 45). A model is handed to the screen and to the print composer, so it must be
 * plain data: no date object, NaN, infinity or `undefined` hiding in an array (a gap is `null`). The one allowed exception is a
 * chart's `formatter`, a pure number-to-text callback that the chart library requires; it is compared by its source text.
 * These are the preconditions of screen/print parity: the same model in, the same figures out, whichever surface paints it.
 */
const isFormatter = (path: string): boolean => /\.formatter$/.test(path);

export function modelProblems(value: unknown, path = "model", seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return [];
  if (typeof value === "number") return Number.isFinite(value) ? [] : [`${path} is not a finite number`];
  if (typeof value === "function") return isFormatter(path) ? [] : [`${path} is a function (only a chart formatter may be)`];
  if (typeof value === "symbol" || typeof value === "bigint") return [`${path} is a ${typeof value}`];
  if (value instanceof Date) return [`${path} is a Date (write the day as text)`];
  if (typeof value !== "object") return [`${path} has an unknown type`];
  if (seen.has(value)) return [`${path} refers back to itself`];
  seen.add(value);
  const out: string[] = [];
  if (Array.isArray(value)) value.forEach((v, i) => { if (v === undefined) out.push(`${path}[${i}] is undefined (a gap is null)`); else out.push(...modelProblems(v, `${path}[${i}]`, seen)); });
  else for (const [k, v] of Object.entries(value)) out.push(...modelProblems(v, `${path}.${k}`, seen));
  seen.delete(value);
  return out;
}

/** Where a model holds a function (only chart formatters are allowed to); such a model is rebuilt from its inputs, never stored. */
export function functionPaths(value: unknown, path = "model"): string[] {
  if (typeof value === "function") return [path];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => functionPaths(v, `${path}.${k}`));
}

/** A stable text for a model, so two models can be compared even when each holds its own copy of the same formatter. */
export function modelFingerprint(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (typeof v === "function") return `[fn ${v.toString()}]`;
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(norm(value) ?? null);
}
