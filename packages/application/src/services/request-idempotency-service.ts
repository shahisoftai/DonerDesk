import type { Result, DomainError } from "@donordesk/domain";
import { idempotencyVerdict, isStorableStatus, isValidIdempotencyKey } from "@donordesk/domain";
import type { IRequestIdempotencyStore, RequestIdempotencyScope } from "../ports/infrastructure.js";

export type BeginOutcome =
  | { kind: "NEW" }
  | { kind: "REPLAY"; statusCode: number; body: string; contentType?: string }
  | { kind: "IN_PROGRESS" }
  | { kind: "INVALID_KEY" };

/**
 * Makes a create request repeatable. The first request with a key runs; a repeat after it finished gets the first
 * response back; a repeat while it is still running is told to wait; a failed first request frees the key.
 */
export class RequestIdempotencyService {
  constructor(
    private readonly store: IRequestIdempotencyStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async begin(scope: RequestIdempotencyScope): Promise<Result<BeginOutcome, DomainError>> {
    if (!isValidIdempotencyKey(scope.key)) return { ok: true, value: { kind: "INVALID_KEY" } };
    // At most two rounds: the second only follows freeing an expired or dead record.
    for (let round = 0; round < 2; round += 1) {
      const inserted = await this.store.insertPending(scope, this.now());
      if (!inserted.ok) return inserted;
      if (inserted.value === "CREATED") return { ok: true, value: { kind: "NEW" } };

      const existing = await this.store.find(scope);
      if (!existing.ok) return existing;
      const record = existing.value;
      if (!record) continue; // released between the insert and the read: try again
      const verdict = idempotencyVerdict(record, this.now());
      if (verdict === "REPLAY" && record.statusCode !== undefined && record.body !== undefined) {
        return { ok: true, value: { kind: "REPLAY", statusCode: record.statusCode, body: record.body, ...(record.contentType ? { contentType: record.contentType } : {}) } };
      }
      if (verdict === "IN_PROGRESS") return { ok: true, value: { kind: "IN_PROGRESS" } };
      const freed = await this.store.release(scope);
      if (!freed.ok) return freed;
    }
    return { ok: true, value: { kind: "IN_PROGRESS" } };
  }

  /** Stores a successful response for replay; any other outcome frees the key so the client can try again. */
  async finish(scope: RequestIdempotencyScope, response: { statusCode: number; body: string; contentType?: string }): Promise<Result<void, DomainError>> {
    if (isStorableStatus(response.statusCode)) return this.store.complete(scope, response, this.now());
    return this.store.release(scope);
  }

  /** The request never produced a response (it threw before sending): free the key. */
  abandon(scope: RequestIdempotencyScope): Promise<Result<void, DomainError>> {
    return this.store.release(scope);
  }
}
