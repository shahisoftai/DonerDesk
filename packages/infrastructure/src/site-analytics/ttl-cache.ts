import type { IStatsCache } from "@donordesk/application";

/** Keeps a value for a fixed time. In this process only: a restart simply reads again. */
export class TtlCache implements IStatsCache {
  private readonly entries = new Map<string, { value: unknown; until: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.until <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.entries.set(key, { value, until: this.now() + this.ttlMs });
  }
}
