/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Queue, Worker, Job } from "bullmq";
import { Queue as BullMQQueue, Worker as BullMQWorker } from "bullmq";
import type { RedisOptions } from "ioredis";

export type JobPriority = "critical" | "high" | "normal" | "low";

export interface JobPayload {
  name: string;
  data: Record<string, unknown>;
  priority?: JobPriority;
  opts?: {
    attempts?: number;
    backoff?: { type: "exponential" | "fixed"; delay: number };
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  };
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type JobHandler = (data: Record<string, unknown>) => Promise<JobResult>;

export interface QueuePool {
  critical: Queue;
  high: Queue;
  normal: Queue;
  low: Queue;
}

export interface WorkerPool {
  critical: Worker;
  high: Worker;
  normal: Worker;
  low: Worker;
}

const PRIORITY_QUEUE_NAMES = ["critical", "high", "normal", "low"] as const;
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export function createPriorityQueues(redisConfig: RedisOptions, prefix = "donordesk"): QueuePool {
  const pools = PRIORITY_QUEUE_NAMES.map((name) => {
    const queue = new BullMQQueue(name, {
      connection: redisConfig,
      prefix,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    return { name, queue };
  });
  return {
    critical: pools[0]!.queue,
    high: pools[1]!.queue,
    normal: pools[2]!.queue,
    low: pools[3]!.queue,
  };
}

export function createPriorityWorkers(
  queues: QueuePool,
  handlers: Record<string, JobHandler>,
  redisConfig: RedisOptions,
  prefix = "donordesk",
): WorkerPool {
  const workers = PRIORITY_QUEUE_NAMES.map((name) => {
    const queue = queues[name];
    const worker = new BullMQWorker(
      name,
      async (job: Job) => {
        const handler = handlers[job.name];
        if (!handler) {
          throw new Error(`No handler registered for job: ${job.name}`);
        }
        const result = await handler(job.data);
        if (!result.success) throw new Error(result.error ?? `Job ${job.name} reported failure`);
        return result;
      },
      {
        connection: redisConfig,
        prefix,
        concurrency: name === "critical" ? 5 : name === "high" ? 3 : name === "normal" ? 2 : 1,
      },
    );
    worker.on("failed", (job, err) => {
      console.error(`[${name}] Job ${job?.id} failed:`, err.message);
    });
    worker.on("completed", (job) => {
      console.log(`[${name}] Job ${job.id} completed`);
    });
    return { name, worker };
  });
  return {
    critical: workers[0]!.worker,
    high: workers[1]!.worker,
    normal: workers[2]!.worker,
    low: workers[3]!.worker,
  };
}

export class PriorityJobQueue {
  private readonly queues: QueuePool;
  private readonly redisConfig: RedisOptions;
  private readonly handlers: Record<string, JobHandler> = {};
  private readonly prefix: string;
  private workers: WorkerPool | null = null;

  constructor(redisConfig: RedisOptions, prefix = "donordesk") {
    this.queues = createPriorityQueues(redisConfig, prefix);
    this.redisConfig = redisConfig;
    this.prefix = prefix;
  }

  register(name: string, handler: JobHandler): void {
    this.handlers[name] = handler;
  }

  async start(): Promise<void> {
    if (this.workers) return;
    this.workers = createPriorityWorkers(this.queues, this.handlers, this.redisConfig, this.prefix);
  }

  async stop(): Promise<void> {
    if (this.workers) {
      await Promise.all([
        this.workers.critical.close(),
        this.workers.high.close(),
        this.workers.normal.close(),
        this.workers.low.close(),
      ]);
      this.workers = null;
    }
    await Promise.all([
      this.queues.critical.close(),
      this.queues.high.close(),
      this.queues.normal.close(),
      this.queues.low.close(),
    ]);
  }

  async enqueue(name: string, data: Record<string, unknown>, priority: JobPriority = "normal"): Promise<string> {
    const queue = this.queues[priority];
    const job = await queue.add(name, data, {
      priority: priority === "critical" ? 1 : priority === "high" ? 2 : priority === "normal" ? 3 : 4,
      ...DEFAULT_JOB_OPTIONS,
    });
    return job.id ?? "";
  }

  async enqueueBulk(jobs: Array<{ name: string; data: Record<string, unknown>; priority?: JobPriority }>): Promise<string[]> {
    const added: string[] = [];
    for (const { name, data, priority = "normal" } of jobs) {
      const id = await this.enqueue(name, data, priority);
      added.push(id);
    }
    return added;
  }
}
