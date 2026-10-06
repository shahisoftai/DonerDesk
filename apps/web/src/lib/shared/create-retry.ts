import type { Result } from "./result.ts";
import type { AppError } from "./app-error.ts";

/**
 * A create that timed out may still have been saved. Because every attempt carries the same idempotency key, repeating
 * it is safe: the API answers with the first response (or "still saving"). Only "unavailable and retryable" is repeated;
 * a validation error, a conflict or a refusal is the real answer and is returned at once.
 */
export interface RetryOptions {
  /** Attempts in total, the first included. */
  attempts?: number;
  waitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Called before each repeat (for a "still saving..." message). */
  onRetry?: (attempt: number) => void;
}

export const CREATE_ATTEMPTS = 4;
export const CREATE_WAIT_MS = 2500;

export function isRetryable(error: AppError): boolean {
  return error.kind === "unavailable" && error.retryable;
}

export async function retryWhileUnavailable<T>(attempt: () => Promise<Result<T, AppError>>, options: RetryOptions = {}): Promise<Result<T, AppError>> {
  const attempts = options.attempts ?? CREATE_ATTEMPTS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let result = await attempt();
  for (let n = 1; n < attempts && !result.ok && isRetryable(result.error); n += 1) {
    options.onRetry?.(n);
    await sleep(options.waitMs ?? CREATE_WAIT_MS);
    result = await attempt();
  }
  return result;
}

/** A fresh key for one intended creation (a form generates it once, when it opens). */
export function newIdempotencyKey(random: () => string = () => globalThis.crypto.randomUUID()): string {
  return `form-${random()}`;
}

/**
 * A key for one file in an upload queue: the queue's own session key plus a hash of the file's identity. The hash keeps
 * spaces and punctuation out of the key; the session part means the same file added again in a later visit is a new
 * upload, not a replay of the old one.
 */
export function fileIdempotencyKey(sessionKey: string, fileIdentity: string): string {
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < fileIdentity.length; i += 1) {
    hash ^= fileIdentity.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${sessionKey}:${hash.toString(16).padStart(8, "0")}`;
}
