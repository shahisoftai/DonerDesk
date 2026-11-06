import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";

interface Scope {
  tx: Prisma.TransactionClient;
  /** Work that must only start once the transaction has committed (background tasks read what it wrote). */
  afterCommit: Array<() => void>;
}

const scope = new AsyncLocalStorage<Scope>();

/**
 * One database transaction around a use case, so the business write and its audit row commit together or not at all.
 *
 * Repositories keep holding "the" Prisma client. `client` is that client: outside a unit of work it is the plain client;
 * inside `run()` every model call, raw query and `$transaction(fn)` is routed to the open transaction (a nested
 * `$transaction(fn)` simply joins it). The tenant session setting is a property of the connection, so row-level security
 * applies exactly as before.
 *
 * Rules for what goes inside: short, database-only work. A repository that catches a database error and carries on
 * (a unique-key retry loop) must not run inside, because Postgres aborts the whole transaction on the first error.
 */
export class UnitOfWork {
  readonly client: PrismaClient;

  constructor(private readonly base: PrismaClient, private readonly options: { timeoutMs?: number; maxWaitMs?: number } = {}) {
    this.client = new Proxy(base, {
      get(target, prop) {
        const active = scope.getStore();
        if (active && typeof prop === "string") {
          if (prop === "$transaction") {
            return (arg: unknown) =>
              typeof arg === "function" ? (arg as (tx: Prisma.TransactionClient) => unknown)(active.tx) : Promise.all(arg as Promise<unknown>[]);
          }
          if (prop in active.tx) return (active.tx as unknown as Record<string, unknown>)[prop];
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  /** True while code is running inside a unit of work. */
  static active(): boolean {
    return scope.getStore() !== undefined;
  }

  /**
   * Runs `work` in one transaction. A throw rolls everything back; a returned value (including a failed Result, which is
   * how expected failures are reported) commits what was written, as it always did. Joins an enclosing unit of work.
   */
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (scope.getStore()) return work();
    const afterCommit: Array<() => void> = [];
    const result = await this.base.$transaction((tx) => scope.run({ tx, afterCommit }, work), {
      timeout: this.options.timeoutMs ?? 20_000,
      maxWait: this.options.maxWaitMs ?? 5_000,
    });
    for (const task of afterCommit) task();
    return result;
  }

  /** Runs `task` now, or — inside a unit of work — once it has committed (and never if it rolls back). */
  static afterCommit(task: () => void): void {
    const active = scope.getStore();
    if (active) active.afterCommit.push(task);
    else task();
  }

  /** Wraps a use case so each `handle` call runs in one unit of work. Returns the same instance. */
  atomic<H extends { handle: (...args: never[]) => Promise<unknown> }>(handler: H): H {
    const original = handler.handle.bind(handler) as (...args: unknown[]) => Promise<unknown>;
    (handler as { handle: unknown }).handle = (...args: unknown[]) => this.run(() => original(...args));
    return handler;
  }
}
