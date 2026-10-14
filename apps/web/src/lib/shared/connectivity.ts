import type { Result } from "./result.ts";
import type { AppError } from "./app-error.ts";

export const OFFLINE_MESSAGE = "You appear to be offline.";

export function offlineError(message = OFFLINE_MESSAGE): AppError {
  return { kind: "unavailable", message, retryable: true };
}

/**
 * Runs a server call so that "no connection" is an ordinary, retryable answer instead of an exception: when the browser
 * knows it is offline the call is not even attempted, and a call that throws (a dropped fetch) becomes the same answer.
 * Everything the server itself says is passed through unchanged.
 */
export async function guardNetwork<T>(
  attempt: () => Promise<Result<T, AppError>>,
  isOnline: () => boolean = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
): Promise<Result<T, AppError>> {
  if (!isOnline()) return { ok: false, error: offlineError() };
  try {
    return await attempt();
  } catch {
    return { ok: false, error: offlineError("The connection was lost before the request finished.") };
  }
}

/** Waiting for a connection is not worth repeating at once; the outbox sends later. */
export function isOfflineFailure(error: AppError | null | undefined): boolean {
  return error?.kind === "unavailable";
}
