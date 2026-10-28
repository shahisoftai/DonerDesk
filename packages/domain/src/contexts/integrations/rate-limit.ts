/**
 * A fixed-window request limit per key (Phase 33.7): at most `limit` requests in each `windowMs`. Pure: the time is passed in, so
 * it is the same rule in the API, a test and any later store. Memory is bounded: windows that have ended are forgotten.
 */
export type RateDecision = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

export class RateWindow {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(readonly limit: number, readonly windowMs: number) {}

  hit(key: string, nowMs: number): RateDecision {
    const start = Math.floor(nowMs / this.windowMs) * this.windowMs;
    const current = this.windows.get(key);
    if (!current || current.start !== start) {
      this.windows.set(key, { start, count: 1 });
      if (this.windows.size > 5_000) for (const [k, w] of this.windows) if (w.start !== start) this.windows.delete(k);
      return { ok: true, remaining: this.limit - 1 };
    }
    if (current.count >= this.limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((start + this.windowMs - nowMs) / 1000)) };
    current.count += 1;
    return { ok: true, remaining: this.limit - current.count };
  }
}
