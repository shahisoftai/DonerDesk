import type { IJobQueue, ILogger } from "@donordesk/application";

export type JobQueueMode = "memory" | "redis" | "kestra";
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Central job router. Application use-cases only ever call `IJobQueue.enqueue`;
 * the dispatcher decides where the work actually runs:
 *
 *   - `memory`: run a registered handler in-process (non-blocking, preserving
 *     the previous fire-and-forget behavior), or log if none is registered.
 *   - `redis` / `kestra`: delegate to the remote queue adapter.
 *
 * Handlers are registered via `register` (OCP: add a handler, don't edit the
 * application layer).
 */
export class JobDispatcher implements IJobQueue {
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    private readonly mode: JobQueueMode,
    private readonly logger: ILogger,
    private readonly remote?: IJobQueue,
  ) {}

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.mode === "memory") {
      const handler = this.handlers.get(name);
      if (handler) {
        setImmediate(() => {
          handler(payload).catch((err: unknown) => this.logger.error("job.handler_failed", { name, err: String(err) }));
        });
      } else {
        this.logger.info("job.dequeued", { name, payload });
      }
      return;
    }
    if (!this.remote) throw new Error(`No remote queue configured for JOB_QUEUE=${this.mode}`);
    await this.remote.enqueue(name, payload);
  }
}
