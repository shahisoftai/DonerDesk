"use client";

import { useCallback, useRef, useState } from "react";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { newIdempotencyKey, retryWhileUnavailable } from "@/lib/shared/create-retry";
import { guardNetwork } from "@/lib/shared/connectivity";

export type ActionState = {
  busy: boolean;
  /** True while a timed-out save is being repeated ("Still saving..."). */
  waiting: boolean;
  error: string | null;
  /** The whole failure of the last action (its kind tells "offline, try later" from "refused"). */
  failure: AppError | null;
  fields: Record<string, string[]> | null;
  /** Runs one action once. A second call while it runs is ignored. */
  run: <T>(action: () => Promise<Result<T, AppError>>) => Promise<T | undefined>;
  /**
   * Runs one *create*. The action receives this form's idempotency key and must pass it to the create action: that is
   * what makes it safe to repeat a save that timed out (done here, with the same key) and to click twice.
   */
  runCreate: <T>(
    action: (idempotencyKey: string) => Promise<Result<T, AppError>>,
    /** Told how it failed, with this form's key, even when the call was never made (offline). */
    onFailure?: (error: AppError, idempotencyKey: string) => void,
  ) => Promise<T | undefined>;
};

export function useActionState(): ActionState {
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<AppError | null>(null);
  const [fields, setFields] = useState<Record<string, string[]> | null>(null);
  const inFlight = useRef(false);
  const key = useRef<string | null>(null);

  const execute = useCallback(async <T,>(attempt: () => Promise<Result<T, AppError>>, repeat: boolean, onFailure?: (error: AppError) => void): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setFailure(null);
    setFields(null);
    try {
      // An offline browser or a dropped fetch is an answer ("unavailable"), never an exception that escapes the form.
      const guarded = () => guardNetwork(attempt);
      const result = repeat ? await retryWhileUnavailable(guarded, { onRetry: () => setWaiting(true) }) : await guarded();
      if (!result.ok) {
        setError(result.error.message);
        setFailure(result.error);
        onFailure?.(result.error);
        if (result.error.kind === "validation" && result.error.fields) {
          setFields(result.error.fields);
        }
        return undefined;
      }
      // An action that succeeds without a value (resolve, verify, toggle) must not look like a failure: callers read `undefined` as "it
      // did not work". Success with nothing to return reports `true`.
      return (result.value === undefined ? (true as unknown as T) : result.value);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setWaiting(false);
    }
  }, []);

  const run = useCallback(<T,>(action: () => Promise<Result<T, AppError>>) => execute(action, false), [execute]);

  const runCreate = useCallback(
    <T,>(action: (idempotencyKey: string) => Promise<Result<T, AppError>>, onFailure?: (error: AppError, idempotencyKey: string) => void) => {
      key.current ??= newIdempotencyKey();
      const idempotencyKey = key.current;
      return execute(() => action(idempotencyKey), true, onFailure ? (error) => onFailure(error, idempotencyKey) : undefined);
    },
    [execute],
  );

  return { busy, waiting, error, failure, fields, run, runCreate };
}
