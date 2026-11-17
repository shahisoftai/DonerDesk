"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { choiceKey, readChoice, writeChoice, type ChoiceStore } from "@/lib/shared/remembered-choice";
import { filtersToRemember, isRestorable } from "@/lib/shared/remembered-filters";

const store = (): ChoiceStore | null => { try { return window.localStorage; } catch { return null; } };

/**
 * Keeps a list's filters on this device (Phase 59). Opening the list with no filters of its own restores the last ones; every change
 * after that is kept, and clearing the filters clears what was kept. Draws nothing. `current` is the list's query string as the server saw it.
 */
export function RememberFilters({ scope, userId, baseUrl, current }: { scope: string; userId: string | null; baseUrl: string; current: string }) {
  const router = useRouter();
  const first = useRef(true);
  const key = choiceKey(userId ?? "anonymous", scope);
  useEffect(() => {
    const now = filtersToRemember(current);
    if (first.current) {
      first.current = false;
      if (current.replace(/^\?/, "") === "") {
        const remembered = readChoice(store(), key, isRestorable);
        if (remembered) router.replace(`${baseUrl}?${remembered}`);
      } else if (now !== "") writeChoice(store(), key, now);
      return;
    }
    writeChoice(store(), key, now === "" ? null : now);
  }, [current, key, baseUrl, router]);
  return null;
}
