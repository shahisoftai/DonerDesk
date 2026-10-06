"use client";

import { useCallback, useRef, useState } from "react";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { newIdempotencyKey, retryWhileUnavailable } from "@/lib/shared/create-retry";

export type ActionState = {
  busy: boolean;
  /** True while a timed-out save is being repeated ("Still saving..."). */
  waiting: boolean;
  error: string | null;
  fields: Record<string, string[]> | null;
  /** Runs one action once. A second call while it runs is ignored. */
  run: <T>(action: () => Promise<Result<T, AppError>>) => Promise<T | undefined>;
  /**
   * Runs one *create*. The action receives this form's idempotency key and must pass it to the create action: that is
   * what makes it safe to repeat a save that timed out (done here, with the same key) and to click twice.
   */
  runCreate: <T>(action: (idempotencyKey: string) => Promise<Result<T, AppError>>) => Promise<T | undefined>;
};

export function useActionState(): ActionState {
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]> | null>(null);
  const inFlight = useRef(false);
  const key = useRef<string | null>(null);

  const execute = useCallback(async <T,>(attempt: () => Promise<Result<T, AppError>>, repeat: boolean): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setFields(null);
    try {
      const result = repeat ? await retryWhileUnavailable(attempt, { onRetry: () => setWaiting(true) }) : await attempt();
      if (!result.ok) {
        setError(result.error.message);
        if (result.error.kind === "validation" && result.error.fields) {
          setFields(result.error.fields);
        }
        return undefined;
      }
      return result.value;
    } finally {
      inFlight.current = false;
      setBusy(false);
      setWaiting(false);
    }
  }, []);

  const run = useCallback(<T,>(action: () => Promise<Result<T, AppError>>) => execute(action, false), [execute]);

  const runCreate = useCallback(
    <T,>(action: (idempotencyKey: string) => Promise<Result<T, AppError>>) => {
      key.current ??= newIdempotencyKey();
      const idempotencyKey = key.current;
      return execute(() => action(idempotencyKey), true);
    },
    [execute],
  );

  return { busy, waiting, error, fields, run, runCreate };
}
