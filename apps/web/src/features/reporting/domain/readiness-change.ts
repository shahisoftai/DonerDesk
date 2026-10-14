/**
 * "What changed since I last looked": the report's readiness can drop without the person doing anything obvious (a
 * section regenerated, a file un-verified). Compared with the snapshot kept in this browser from the previous visit, this
 * names the overall move and the parts that moved most. Local by design: it needs no server state and says "since your last visit".
 */

export interface ReadinessSnapshot {
  overall: number;
  sections: number;
  indicators: number;
  evidence: number;
  checklist: number;
  approval: number;
}

const LABELS: Record<Exclude<keyof ReadinessSnapshot, "overall">, string> = {
  sections: "Sections",
  indicators: "Indicators",
  evidence: "Evidence",
  checklist: "Checklist",
  approval: "Approval",
};

export interface ReadinessChange {
  direction: "up" | "down";
  from: number;
  to: number;
  /** The parts that moved, biggest first, e.g. "Sections 100% → 50%". */
  moved: string[];
}

const pct = (n: number) => `${Math.round(n)}%`;

/** Null when there is nothing to compare or nothing moved by a visible amount (under one point overall and in every part). */
export function describeReadinessChange(before: ReadinessSnapshot | null, now: ReadinessSnapshot): ReadinessChange | null {
  if (!before) return null;
  const parts = (Object.keys(LABELS) as Array<keyof typeof LABELS>)
    .map((key) => ({ key, delta: now[key] - before[key] }))
    .filter((p) => Math.abs(p.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (Math.abs(now.overall - before.overall) < 1 && parts.length === 0) return null;
  return {
    direction: now.overall >= before.overall ? "up" : "down",
    from: Math.round(before.overall),
    to: Math.round(now.overall),
    moved: parts.slice(0, 3).map((p) => `${LABELS[p.key]} ${pct(before[p.key])} → ${pct(now[p.key])}`),
  };
}

export function readinessChangeSentence(change: ReadinessChange): string {
  const head = `${change.direction === "down" ? "Down" : "Up"} from ${change.from}% to ${change.to}% since your last visit`;
  return change.moved.length > 0 ? `${head}: ${change.moved.join(", ")}.` : `${head}.`;
}

export function parseReadinessSnapshot(raw: unknown): ReadinessSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const keys: Array<keyof ReadinessSnapshot> = ["overall", "sections", "indicators", "evidence", "checklist", "approval"];
  const out = {} as ReadinessSnapshot;
  for (const k of keys) {
    const v = r[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out;
}
