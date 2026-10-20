import type { IFailedJobStore, IJobQueue, ILogger } from "@donordesk/application";

/** After this many failed hand-offs a job is dead-lettered (kept, visible, no longer retried). */
export const MAX_JOB_ATTEMPTS = 8;

/** 30 s, 1 m, 2 m, 4 m ... capped at one hour. `attempt` is the number of hand-offs already made. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 60 * 60_000);
}

export interface RetryOutcome {
  retried: number;
  done: number;
  failed: number;
  dead: number;
}

/**
 * Hands the jobs the API could not queue to the queue again. A job that still fails waits longer each time and is
 * dead-lettered after MAX_JOB_ATTEMPTS, with an error-level log, instead of being lost.
 */
export class JobRetryRunner {
  constructor(
    private readonly store: IFailedJobStore,
    private readonly queue: IJobQueue,
    private readonly logger: ILogger,
    private readonly batch = 20,
  ) {}

  async runOnce(now: Date = new Date()): Promise<RetryOutcome> {
    const outcome: RetryOutcome = { retried: 0, done: 0, failed: 0, dead: 0 };
    const due = await this.store.claimDue(now, this.batch);
    for (const job of due) {
      outcome.retried += 1;
      try {
        await this.queue.enqueue(job.jobName, job.payload);
        await this.store.markDone(job.id);
        outcome.done += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = job.attempts + 1;
        const give = attempts >= MAX_JOB_ATTEMPTS;
        await this.store.markFailed(job.id, message, give ? null : new Date(now.getTime() + retryDelayMs(attempts)));
        outcome.failed += 1;
        if (give) {
          outcome.dead += 1;
          this.logger.error("job.dead_lettered", { jobName: job.jobName, jobId: job.id, attempts, error: message });
        }
      }
    }
    return outcome;
  }
}
