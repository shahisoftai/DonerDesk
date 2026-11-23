import { blank } from "./answer-values.js";
import type { FormDefinition } from "./form-model.js";

/**
 * Prefill from the last visit (Phase 62.5, anticipated gap A5): only the facts the form marks `carryForward` (year established,
 * catchment population), only into an empty answer, and always returned apart so the screen can say "from the last visit" and the
 * assessor confirms them. Nothing is submitted unconfirmed; a figure that changes often is never carried.
 */
export function prefillFromLast(form: FormDefinition, last: Readonly<Record<string, unknown>>, current: Readonly<Record<string, unknown>> = {}): { values: Record<string, unknown>; carried: string[] } {
  const values: Record<string, unknown> = {};
  const carried: string[] = [];
  for (const f of form.fields) {
    if (!f.carryForward || !blank(current[f.key]) || blank(last[f.key])) continue;
    values[f.key] = last[f.key];
    carried.push(f.key);
  }
  return { values, carried };
}
