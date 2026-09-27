export interface IndicatorProgress {
  baseline: number;
  target: number;
  current: number;
  /** Share of the baseline → target distance covered, clamped to [0, 1]. */
  fraction: number;
  /** Unclamped share, so over-achievement (> 1) and regression (< 0) stay visible. */
  rawFraction: number;
}

export function parseIndicatorNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[,\s%]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Progress from baseline toward target; works for decreasing targets too. Null when not computable. */
export function computeIndicatorProgress(
  baseline: string | null | undefined,
  target: string | null | undefined,
  current: string | null | undefined,
): IndicatorProgress | null {
  const b = parseIndicatorNumber(baseline) ?? 0;
  const t = parseIndicatorNumber(target);
  const c = parseIndicatorNumber(current);
  if (t === null || c === null || t === b) return null;
  const rawFraction = (c - b) / (t - b);
  return { baseline: b, target: t, current: c, rawFraction, fraction: Math.min(1, Math.max(0, rawFraction)) };
}
