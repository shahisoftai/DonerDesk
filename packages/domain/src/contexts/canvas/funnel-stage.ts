/**
 * Where a funnel stage's figure comes from (Phase 60.2). The screen model and the print painter both call `funnelStageAmount`, so
 * "people in need", "targeted" and "reached" can never read differently on screen and in a file. A source is a row in `STAGE_SOURCES`;
 * a stage with no source and no typed figure is "not yet reported" (`null`), never 0. A rate or an unrecorded indicator is never a
 * people count, so it gives `null` too.
 */

/** The narrow view of the facts a funnel reads (both the canvas and the Studio can supply it). */
export interface FunnelFacts {
  reach: { overallUnique: number; registeredTotal: number };
  /** The latest recorded value of an indicator, if any. */
  latest(indicatorId: string): { number: number | null; isRate: boolean; verified: boolean } | undefined;
}

export interface FunnelStageSource {
  value?: number | undefined;
  bind?: string | undefined;
  indicatorId?: string | undefined;
}

export interface FunnelAmount {
  amount: number | null;
  /** False only when the figure comes from a recorded value that is not verified yet. */
  verified: boolean;
}

const STAGE_SOURCES: Readonly<Record<string, (f: FunnelFacts) => number | null>> = {
  REACH_UNIQUE: (f) => f.reach.overallUnique || null,
  REACH_REGISTERED: (f) => f.reach.registeredTotal || null,
};

/** The bind keys a stage may name. */
export const FUNNEL_BINDS: readonly string[] = Object.keys(STAGE_SOURCES);

export function funnelStageAmount(stage: FunnelStageSource, facts: FunnelFacts): FunnelAmount {
  if (stage.bind) return { amount: STAGE_SOURCES[stage.bind]?.(facts) ?? null, verified: true };
  if (stage.indicatorId) {
    const found = facts.latest(stage.indicatorId);
    if (!found || found.isRate || found.number === null || found.number < 0) return { amount: null, verified: true };
    return { amount: Math.round(found.number), verified: found.verified };
  }
  return { amount: stage.value ?? null, verified: true };
}
