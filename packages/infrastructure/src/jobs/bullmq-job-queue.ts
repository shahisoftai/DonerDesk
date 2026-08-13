import type { IJobQueue } from "@donordesk/application";
import type { RedisOptions } from "ioredis";
import { PriorityJobQueue, type JobPriority } from "../security/priority-queue.js";

/** Build a RedisOptions from env. A dedicated ACL user is expected (contabo-ops §6). */
export function redisConfigFromEnv(): RedisOptions {
  const url = process.env.REDIS_URL;
  if (url) return redisConfigFromUrl(url);
  const config: RedisOptions = {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
  if (process.env.REDIS_USERNAME) config.username = process.env.REDIS_USERNAME;
  if (process.env.REDIS_PASSWORD) config.password = process.env.REDIS_PASSWORD;
  if (process.env.REDIS_DB) config.db = Number(process.env.REDIS_DB);
  return config;
}

function redisConfigFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const config: RedisOptions = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };
  if (parsed.username) config.username = decodeURIComponent(parsed.username);
  if (parsed.password) config.password = decodeURIComponent(parsed.password);
  if (parsed.pathname && parsed.pathname !== "/") {
    const db = Number(parsed.pathname.slice(1));
    if (!Number.isNaN(db)) config.db = db;
  }
  return config;
}

/** Narrow seam so the adapter is testable without a live Redis connection. */
export interface PriorityQueueSeam {
  enqueue(name: string, data: Record<string, unknown>, priority: JobPriority): Promise<string>;
}

/**
 * Adapts the existing BullMQ `PriorityJobQueue` behind the application's
 * `IJobQueue`. Only constructed when `JOB_QUEUE=redis`; the connection is
 * lazy, so creating the adapter does not require a live Redis.
 */
export class BullMQJobQueue implements IJobQueue {
  constructor(private readonly queue: PriorityQueueSeam = new PriorityJobQueue(redisConfigFromEnv(), process.env.REDIS_PREFIX ?? "donordesk")) {}

  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    await this.queue.enqueue(name, payload, "normal");
  }
}
