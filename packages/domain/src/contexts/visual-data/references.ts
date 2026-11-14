/**
 * Standards on a visual (Phase 54, §3.12): a reference line ("cure rate 75 %") or band, labelled with where it comes from and whether
 * anyone has reviewed it. A reference is shown beside the figures and never changes them or replaces a target's stoplight.
 */
export interface ChartReference {
  kind: "LINE" | "BAND";
  value?: number | undefined;
  from?: number | undefined;
  to?: number | undefined;
  label: string;
  /** Whether the line is a floor ("at least") or a ceiling ("below"): colours the side that meets it. */
  role?: "AT_LEAST" | "AT_MOST" | "INFO" | undefined;
  /** "Sphere (unreviewed)": the source and review state the label carries. */
  source?: string | undefined;
}

export const MAX_REFERENCES = 6;

export function referenceProblems(refs: readonly ChartReference[], canHold: boolean): string[] {
  if (refs.length === 0) return [];
  if (!canHold) return ["This kind of picture cannot show a reference line."];
  const out: string[] = [];
  if (refs.length > MAX_REFERENCES) out.push(`A picture shows at most ${MAX_REFERENCES} reference lines.`);
  for (const r of refs) {
    if (!r.label.trim() || r.label.length > 80) out.push("Each reference line needs a short label.");
    if (r.kind === "LINE" && (typeof r.value !== "number" || !Number.isFinite(r.value))) out.push(`'${r.label}': give the value the line is drawn at.`);
    if (r.kind === "BAND" && (typeof r.from !== "number" || typeof r.to !== "number" || r.from >= r.to)) out.push(`'${r.label}': a band goes from a lower to a higher value.`);
  }
  return [...new Set(out)];
}

/** The label drawn on the line: the person's words plus the source and review state ("Cure rate 75 % · Sphere (unreviewed)"). */
export const referenceLabel = (r: ChartReference): string => (r.source ? `${r.label} · ${r.source}` : r.label);

/** Does a figure meet the reference? null when the reference is for information only or the figure is missing. */
export function meetsReference(value: number | null, r: ChartReference): boolean | null {
  if (value === null || r.kind !== "LINE" || r.value === undefined || !r.role || r.role === "INFO") return null;
  return r.role === "AT_LEAST" ? value >= r.value : value <= r.value;
}
