"use client";

import { useCallback, useRef, useState } from "react";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export type ActionState = {
  busy: boolean;
  error: string | null;
  fields: Record<string, string[]> | null;
  run: <T>(action: () => Promise<Result<T, AppError>>) => Promise<T | undefined>;
};

export function useActionState(): ActionState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]> | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(action: () => Promise<Result<T, AppError>>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setFields(null);
    try {
      const result = await action();
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
    }
  }, []);

  return { busy, error, fields, run };
}
