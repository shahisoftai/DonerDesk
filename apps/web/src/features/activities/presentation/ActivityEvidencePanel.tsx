"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { attachEvidenceAction, detachEvidenceAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

type EvidenceOption = { id: string; label: string; checked: boolean };

export function ActivityEvidencePanel({
  activityId,
  projectId,
  attachedEvidenceIds,
  availableEvidence,
}: {
  activityId: string;
  projectId: string;
  attachedEvidenceIds: string[];
  availableEvidence: EvidenceOption[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [selected, setSelected] = useState<Set<string>>(new Set(attachedEvidenceIds));
  const [showPicker, setShowPicker] = useState(false);

  function toggleEvidence(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveChanges() {
    const toAttach = [...selected].filter((id) => !attachedEvidenceIds.includes(id));
    const toDetach = attachedEvidenceIds.filter((id) => !selected.has(id));

    let hasError = false;

    for (const evidenceId of toAttach) {
      const result = await actionState.run(() =>
        attachEvidenceAction({ evidenceId, activityId }),
      );
      if (!result) hasError = true;
    }

    for (const evidenceId of toDetach) {
      const result = await actionState.run(() =>
        detachEvidenceAction({ evidenceId, activityId }),
      );
      if (!result) hasError = true;
    }

    if (!hasError) {
      router.refresh();
      setShowPicker(false);
    }
  }

  async function attachSingle(evidenceId: string) {
    const result = await actionState.run(() =>
      attachEvidenceAction({ evidenceId, activityId }),
    );
    if (result) {
      setSelected((prev) => new Set([...prev, evidenceId]));
      router.refresh();
    }
  }

  async function detachSingle(evidenceId: string) {
    const result = await actionState.run(() =>
      detachEvidenceAction({ evidenceId, activityId }),
    );
    if (result) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(evidenceId);
        return next;
      });
      router.refresh();
    }
  }

  const notAttached = availableEvidence.filter((e) => !selected.has(e.id));

  return (
    <section className="card" aria-label="Attached evidence">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Attached evidence</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
        >
          {showPicker ? "Done" : "Manage"}
        </Button>
      </div>

      {selected.size === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No evidence attached yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {[...selected].map((id) => {
            const evidence = availableEvidence.find((e) => e.id === id);
            return (
              <li key={id} className="flex items-center justify-between text-sm">
                <span className="text-brand-600 dark:text-brand-400">
                  {evidence?.label ?? "Unknown evidence"}
                </span>
                {showPicker && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => detachSingle(id)}
                    pending={actionState.busy}
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showPicker && notAttached.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Available evidence to attach
          </p>
          <div className="space-y-2">
            {notAttached.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selected.has(e.id)}
                    onChange={() => toggleEvidence(e.id)}
                  />
                  <span>{e.label}</span>
                </label>
                {!selected.has(e.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => attachSingle(e.id)}
                    pending={actionState.busy}
                  >
                    Attach
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showPicker && selected.size !== attachedEvidenceIds.length && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={saveChanges}
            pending={actionState.busy}
          >
            Save changes
          </Button>
        </div>
      )}
    </section>
  );
}
