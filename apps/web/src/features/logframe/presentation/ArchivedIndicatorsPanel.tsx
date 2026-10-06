"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreIndicatorAction } from "@/lib/actions/indicators";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { formatDate } from "@/lib/shared/dates";

export interface ArchivedIndicator {
  id: string;
  code: string;
  name: string;
  archivedAt: string;
}

/** Removed indicators that had values: hidden everywhere, kept for history, and brought back here. */
export function ArchivedIndicatorsPanel({ items }: { items: ArchivedIndicator[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    const result = await restoreIndicatorAction(id);
    setBusyId(null);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  return (
    <section className="mt-10" aria-labelledby="archived-heading">
      <h2 id="archived-heading" className="font-medium">Archived indicators ({items.length})</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Removed indicators that had recorded values. They are hidden from the grid and new reports, and their history is kept. Restore one to use it again.
      </p>
      {error && <div className="mt-3"><InlineAlert tone="danger" title={error} /></div>}
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium"><span className="font-mono text-xs text-slate-500">{i.code}</span> {i.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Archived {formatDate(i.archivedAt)}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void restore(i.id)} pending={busyId === i.id} disabled={busyId !== null}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
