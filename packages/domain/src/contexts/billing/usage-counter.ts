import { DomainError } from "../../core/domain-error.js";

export type UsageMetric = "MANAGED_STORAGE_BYTES" | "AI_DRAFT_CREDITS";

export const USAGE_METRICS: readonly UsageMetric[] = ["MANAGED_STORAGE_BYTES", "AI_DRAFT_CREDITS"];

export function isUsageMetric(value: unknown): value is UsageMetric {
  return typeof value === "string" && (USAGE_METRICS as readonly string[]).includes(value);
}

export interface UsageCounterState {
  metric: UsageMetric;
  /** UTC month start (YYYY-MM-01T00:00:00Z) the counter belongs to. */
  periodStart: Date;
  used: bigint;
  reserved: bigint;
}

/**
 * Value object describing an atomic usage/reservation counter. Handlers call
 * reserve() before external work and consume()/release() after, so capacity is
 * never exceeded under concurrency without serializing the counter row.
 */
export class UsageCounter {
  private constructor(private readonly state: UsageCounterState) {}

  static create(state: UsageCounterState): UsageCounter {
    if (!isUsageMetric(state.metric)) throw DomainError.validation(`Unknown usage metric: ${state.metric}`);
    if (state.used < 0n) throw DomainError.validation("Used must be non-negative");
    if (state.reserved < 0n) throw DomainError.validation("Reserved must be non-negative");
    return new UsageCounter(state);
  }

  static metric(): { storage(): "MANAGED_STORAGE_BYTES"; aiCredits(): "AI_DRAFT_CREDITS" } {
    return { storage: () => "MANAGED_STORAGE_BYTES", aiCredits: () => "AI_DRAFT_CREDITS" };
  }

  get metric(): UsageMetric { return this.state.metric; }
  get periodStart(): Date { return new Date(this.state.periodStart.getTime()); }
  get used(): bigint { return this.state.used; }
  get reserved(): bigint { return this.state.reserved; }

  totalCommitted(): bigint {
    return this.state.used + this.state.reserved;
  }

  reserve(units: bigint): UsageCounter {
    if (units <= 0n) throw DomainError.validation("Reservation must be positive");
    return new UsageCounter({ ...this.state, reserved: this.state.reserved + units });
  }

  consumeReserved(units: bigint): UsageCounter {
    if (units <= 0n) throw DomainError.validation("Consumption must be positive");
    if (units > this.state.reserved) throw DomainError.invariant("Cannot consume beyond reserved units");
    return new UsageCounter({
      ...this.state,
      reserved: this.state.reserved - units,
      used: this.state.used + units,
    });
  }

  release(units: bigint): UsageCounter {
    if (units <= 0n) throw DomainError.validation("Release must be positive");
    if (units > this.state.reserved) throw DomainError.invariant("Cannot release beyond reserved units");
    return new UsageCounter({ ...this.state, reserved: this.state.reserved - units });
  }

  usedMinus(units: bigint): UsageCounter {
    if (units <= 0n) throw DomainError.validation("Decrement must be positive");
    if (units > this.state.used) throw DomainError.invariant("Cannot decrement beyond used units");
    return new UsageCounter({ ...this.state, used: this.state.used - units });
  }
}

/** True when two counters belong to the same metric + UTC month period. */
export function sameUsagePeriod(a: UsageCounter, b: UsageCounter): boolean {
  return a.metric === b.metric && a.periodStart.getTime() === b.periodStart.getTime();
}
