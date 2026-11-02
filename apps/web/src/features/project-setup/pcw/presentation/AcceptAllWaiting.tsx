"use client";

import { useTransition } from "react";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { waitingPaths } from "../domain/documents-view";

/**
 * "Confirm all that are waiting" for the items read from documents. Only items nobody has decided are included; anything the person
 * removed or edited is left as it is. Shown only when something is waiting.
 */
export function AcceptAllWaiting({ id, area, items, onView, onError }: { id: string; area: string; items: ReadonlyArray<{ path: string; status: string }>; onView: (v: SetupDraftView) => void; onError: (m: string) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const paths = waitingPaths(items);
  const [pending, start] = useTransition();
  if (paths.length < 2) return null;
  return (
    <button
      type="button" className="btn-secondary" disabled={pending}
      onClick={() => start(async () => {
        const r = await editSetupItemAction(id, { area, op: "ACCEPT_MANY", paths });
        if (!r.ok) return onError(r.error.message);
        const fresh = await getDraftAction(id);
        if (fresh.ok) onView(fresh.value); else onError(fresh.error.message);
      })}
    >
      {PCW_COPY.acceptAll(paths.length)}
    </button>
  );
}
