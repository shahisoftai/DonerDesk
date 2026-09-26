import type { IPasswordResetRateLimiter } from "@donordesk/application";

interface BucketEntry {
  timestamps: number[];
}

export class InMemoryPasswordResetRateLimiter implements IPasswordResetRateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();

  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.buckets.get(key) ?? { timestamps: [] };
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length >= limit) {
      this.buckets.set(key, entry);
      return false;
    }
    entry.timestamps.push(now);
    this.buckets.set(key, entry);
    return true;
  }

  clear(): void {
    this.buckets.clear();
  }
}
