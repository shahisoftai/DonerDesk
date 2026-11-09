/**
 * Threshold alerts and saved views (Phase 48.16). An alert is a rule on one figure a person subscribes to; it is evaluated against a
 * resolved table, fires once per crossing (not on every run), and carries only ids and figures, never text from the records.
 * A saved view is a person's own parameter choices for one canvas; it is a set of parameter values, nothing else.
 */
export const ALERT_RULES = ["BELOW", "ABOVE", "NO_VALUE", "BELOW_PERCENT_OF_TARGET", "WORSE_THAN_PREVIOUS"] as const;
export type AlertRuleKind = (typeof ALERT_RULES)[number];

export interface AlertRule { kind: AlertRuleKind; /** The figure for BELOW/ABOVE, or the percent for BELOW_PERCENT_OF_TARGET. */ value?: number | undefined }
export type AlertState = "OK" | "FIRING" | "NO_DATA";

export interface AlertInput { current: number | null; previous?: number | null | undefined; target?: number | null | undefined; lowerIsBetter?: boolean | undefined; isRate?: boolean | undefined }

export function alertRuleProblems(rule: AlertRule): string[] {
  if (!(ALERT_RULES as readonly string[]).includes(rule.kind)) return ["Unknown alert rule."];
  const needsValue = rule.kind === "BELOW" || rule.kind === "ABOVE" || rule.kind === "BELOW_PERCENT_OF_TARGET";
  if (needsValue && (rule.value === undefined || !Number.isFinite(rule.value))) return ["This rule needs a number."];
  if (rule.kind === "BELOW_PERCENT_OF_TARGET" && ((rule.value as number) < 0 || (rule.value as number) > 1000)) return ["A percent of target is between 0 and 1000."];
  return [];
}

/** NO_DATA is not "OK" and not "firing": a missing figure is only an alert when the rule is about a missing figure. */
export function evaluateAlert(rule: AlertRule, input: AlertInput): AlertState {
  if (rule.kind === "NO_VALUE") return input.current === null ? "FIRING" : "OK";
  if (input.current === null) return "NO_DATA";
  switch (rule.kind) {
    case "BELOW": return input.current < (rule.value as number) ? "FIRING" : "OK";
    case "ABOVE": return input.current > (rule.value as number) ? "FIRING" : "OK";
    case "BELOW_PERCENT_OF_TARGET": {
      // A rate, an indicator where lower is better, or a missing or zero target has no percent of target: never judged.
      if (input.isRate || input.lowerIsBetter || input.target === null || input.target === undefined || input.target <= 0) return "NO_DATA";
      return (input.current / input.target) * 100 < (rule.value as number) ? "FIRING" : "OK";
    }
    case "WORSE_THAN_PREVIOUS": {
      if (input.previous === null || input.previous === undefined) return "NO_DATA";
      return (input.lowerIsBetter ? input.current > input.previous : input.current < input.previous) ? "FIRING" : "OK";
    }
  }
}

/** An alert fires once when it crosses from not firing into firing; staying in firing, or recovering, tells nobody. */
export const shouldNotify = (before: AlertState | undefined, after: AlertState): boolean => after === "FIRING" && before !== "FIRING";

export interface SavedView { id: string; name: string; canvasId: string; values: Record<string, string | string[] | { from: string; to: string } | null> }
export const MAX_VIEWS_PER_CANVAS = 20;

export function savedViewProblems(view: SavedView, paramIds: ReadonlySet<string>, existing: ReadonlyArray<SavedView> = []): string[] {
  const out: string[] = [];
  if (!view.name.trim() || view.name.length > 60) out.push("A view's name is 1 to 60 characters.");
  if (existing.filter((v) => v.canvasId === view.canvasId && v.id !== view.id).length >= MAX_VIEWS_PER_CANVAS) out.push(`A canvas keeps at most ${MAX_VIEWS_PER_CANVAS} saved views per person.`);
  for (const k of Object.keys(view.values)) if (!paramIds.has(k)) out.push(`The view sets a parameter that no longer exists (${k}).`);
  return out;
}

/** A view applied to a canvas whose parameters changed: choices for parameters that are gone are dropped and named. */
export function applyView(view: SavedView, paramIds: ReadonlySet<string>): { values: SavedView["values"]; dropped: string[] } {
  const values: SavedView["values"] = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(view.values)) (paramIds.has(k) ? (values[k] = v) : dropped.push(k));
  return { values, dropped };
}
