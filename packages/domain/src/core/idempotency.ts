/**
 * Rules for a client-supplied idempotency key on a create request. A key identifies one intended creation: the form
 * generates it when it opens, so a double click or a retry after a timeout repeats the same key and gets the first
 * result back. Pure: the store and the service build on these.
 */

/** A repeated key is answered from the stored response for this long; after it the key is free again. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** A request still running after this long is taken to have died; its key may be used again. */
export const IDEMPOTENCY_PENDING_TIMEOUT_MS = 2 * 60 * 1000;

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_:.-]{7,127}$/;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && KEY_RE.test(key);
}

/** Only a successful creation is stored; a failed one must stay retryable with the same key. */
export function isStorableStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

export type IdempotencyVerdict = "REPLAY" | "IN_PROGRESS" | "FREE";

/** What a record that already exists means for a new request with the same key. */
export function idempotencyVerdict(record: { state: string; createdAt: Date }, now: Date): IdempotencyVerdict {
  const age = now.getTime() - record.createdAt.getTime();
  if (record.state === "DONE") return age < IDEMPOTENCY_TTL_MS ? "REPLAY" : "FREE";
  return age < IDEMPOTENCY_PENDING_TIMEOUT_MS ? "IN_PROGRESS" : "FREE";
}
