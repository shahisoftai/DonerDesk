import type { IJobQueue, ILogger } from "@donordesk/application";
import { BullMQJobQueue } from "./bullmq-job-queue.js";
import { JobDispatcher, type JobQueueMode } from "./dispatcher.js";
import { KestraJobQueue } from "./kestra-job-queue.js";

/**
 * Selects the job queue implementation from `JOB_QUEUE` (default `memory`).
 * One factory keeps selection in one place (SRP/DIP); existing tests and the
 * synchronous core keep working because the default is unchanged.
 */
export function createJobQueue(logger: ILogger): IJobQueue {
  const mode = (process.env.JOB_QUEUE ?? "memory") as JobQueueMode;
  let remote: IJobQueue | undefined;
  if (mode === "kestra") remote = new KestraJobQueue();
  else if (mode === "redis") remote = new BullMQJobQueue();
  return new JobDispatcher(mode, logger, remote);
}

export { JobDispatcher, type JobQueueMode } from "./dispatcher.js";
export { KestraJobQueue, type KestraJobQueueOptions, type KestraFlowRef } from "./kestra-job-queue.js";
export { BullMQJobQueue, redisConfigFromEnv, type PriorityQueueSeam } from "./bullmq-job-queue.js";
