"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { bulkVerifyEvidenceAction } from "@/lib/actions/evidence";
import { toggleSelection } from "@/features/activities/domain/bulk-selection";
import { countOf } from "@donordesk/domain/core/plural.js";

type Selection = { selected: string[]; toggle: (id: string) => void; set: (ids: string[]) => void; clear: () => void };
const SelectionContext = createContext<Selection | null>(null);

/** Holds which files of the list are ticked; the table rows and the bar above them share it. */
export function EvidenceSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const value: Selection = { selected, toggle: (id) => setSelected((s) => toggleSelection(s, id)), set: setSelected, clear: () => setSelected([]) };
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("EvidenceSelectionProvider is missing");
  return ctx;
}

export function EvidenceSelectBox({ id, title }: { id: string; title: string }) {
  const { selected, toggle } = useSelection();
  return <Checkbox aria-label={`Select ${title}`} checked={selected.includes(id)} onChange={() => toggle(id)} />;
}

/** "Verify selected": one action for a month of files, with a result per file. */
export function EvidenceBulkBar({ pendingIds, canVerify }: { pendingIds: string[]; canVerify: boolean }) {
  const router = useRouter();
  const { selected, set, clear } = useSelection();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  if (!canVerify) return null;

  async function verify() {
    setBusy(true);
    setMessage(null);
    const result = await bulkVerifyEvidenceAction(selected);
    setBusy(false);
    if (!result.ok) return setMessage(result.error.message);
    setMessage(`${countOf(result.value.succeeded, "file")} verified${result.value.failed ? `, ${result.value.failed} could not be verified` : ""}.`);
    setFailures(result.value.results.filter((r) => !r.ok).map((r) => r.error ?? "Could not verify"));
    clear();
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" role="region" aria-label="Verify several files">
      <Button size="sm" variant="secondary" disabled={pendingIds.length === 0} onClick={() => set(pendingIds)}>
        Select all {pendingIds.length} awaiting verification on this page
      </Button>
      <Button size="sm" disabled={selected.length === 0 || busy} pending={busy} onClick={() => void verify()}>
        Verify {selected.length > 0 ? countOf(selected.length, "selected file") : "selected"}
      </Button>
      {selected.length > 0 && <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>}
      {message && <span role="status">{message}</span>}
      {failures.length > 0 && <ul className="w-full list-disc pl-5 text-danger-700 dark:text-danger-400">{failures.map((f, i) => <li key={i}>{f}</li>)}</ul>}
    </div>
  );
}
