"use client";

import { useState } from "react";
import { addPlaceInlineAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PickerChoice } from "../../domain/picker-order";
import type { InlinePlaceResult } from "@/lib/server/schemas-place-tree";

/**
 * Add a place without leaving the form (Phase 56): a name and the area it is in (one of this project's areas or places). It is created under
 * that parent, never floating; a name already under that parent is the existing place, not a copy.
 */
export function InlineAddPlace({ projectId, initialName, parents, onAdded, onCancel }: {
  projectId: string;
  initialName: string;
  parents: readonly PickerChoice[];
  onAdded: (result: InlinePlaceResult) => void;
  onCancel: () => void;
}) {
  const state = useActionState();
  const hydrated = useHydrated();
  const [name, setName] = useState(initialName);
  const [parentId, setParentId] = useState(parents[0]?.id ?? "");
  const [facility, setFacility] = useState(false);

  async function add() {
    const result = await state.run(() => addPlaceInlineAction(projectId, { name, parent: { placeId: parentId }, ...(facility ? { facility: true } : {}) }));
    if (result) onAdded(result);
  }

  if (parents.length === 0) {
    return <p className="text-xs text-slate-600 dark:text-slate-300">Choose this project&apos;s areas first (Plan › Where we work); a new place is added inside one of them.</p>;
  }
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-white/10" role="group" aria-label="Add a new place">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="Inside"><Select value={parentId} onChange={(e) => setParentId(e.target.value)}>{parents.map((p) => <option key={p.id} value={p.id}>{p.path}</option>)}</Select></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={facility} onChange={(e) => setFacility(e.target.checked)} /> A facility people go to (clinic, school, water point)</label>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!hydrated || state.busy || !name.trim() || !parentId} onClick={() => void add()}>Add place</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
