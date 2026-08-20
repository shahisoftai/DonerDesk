"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptEvidenceTagsAction } from "@/lib/actions/evidence";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/data/Badge";
import { TAG_FIELD_LABEL, TAG_CONFIDENCE_LABEL } from "@/lib/labels";

type Tag = { field: string; value: string; confidence?: string; accepted?: boolean };

export function EvidenceTagReview({ evidenceId, tags, demoMode }: { evidenceId: string; tags: Tag[]; demoMode: boolean }) {
  const router = useRouter();
  const actionState = useActionState();
  const [selected, setSelected] = useState<number[]>([]);

  if (tags.length === 0) return null;

  const pendingIndices = tags.map((t, i) => (t.accepted ? -1 : i)).filter((i) => i >= 0);
  const canSubmit = selected.length > 0 && pendingIndices.length > 0;

  function toggle(index: number) {
    setSelected((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  async function submit() {
    const result = await actionState.run(() => acceptEvidenceTagsAction(evidenceId, selected));
    if (result !== undefined) {
      setSelected([]);
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="tag-review-title" className="rounded-xl border border-ai-500/30 bg-ai-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="tag-review-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">
          AI-suggested tags
        </h2>
        {demoMode && (
          <span className="rounded-full border border-ai-500/30 bg-ai-500/10 px-2 py-0.5 text-xs font-medium text-ai-700 dark:text-ai-400">
            Demo mode
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Review the suggestions and accept the ones you agree with. Suggestions are only applied after you confirm.
      </p>

      <ul className="mt-3 space-y-2">
        {tags.map((tag, index) => (
          <li
            key={`${tag.field}:${tag.value}:${index}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/50 p-2.5 dark:border-white/10 dark:bg-slate-900/40"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                checked={selected.includes(index)}
                disabled={tag.accepted}
                onChange={() => toggle(index)}
              />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{TAG_FIELD_LABEL[tag.field] ?? tag.field}</span>
                <span className="ml-1 text-slate-500 dark:text-slate-400">: {tag.value}</span>
              </span>
            </label>
            {tag.accepted ? (
              <Badge tone="success">Accepted</Badge>
            ) : (
              <Badge tone={tag.confidence === "HIGH" ? "info" : tag.confidence === "LOW" ? "warning" : "neutral"}>
                {TAG_CONFIDENCE_LABEL[tag.confidence ?? ""] ?? tag.confidence ?? "Unknown"}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      {canSubmit && (
        <div className="mt-3">
          <Button size="sm" onClick={submit} pending={actionState.busy}>
            Accept {selected.length} selected
          </Button>
        </div>
      )}

      {pendingIndices.length === 0 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">All suggestions have been reviewed.</p>
      )}

      {actionState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </section>
  );
}
