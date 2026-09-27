"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { cloneTemplateAction } from "@/lib/actions/templates";

/** Copies a reviewed template from the organisation's library into this project. */
export function LibraryPicker({ projectId, items }: { projectId: string; items: Array<{ id: string; templateName: string; donorName: string; sections: number }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function adopt(id: string) {
    setBusy(id);
    setError(null);
    const r = await cloneTemplateAction(id, projectId);
    setBusy(null);
    if (!r.ok) setError(r.error.message);
    else router.push(`/projects/${projectId}/templates/${r.value.id}`);
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-medium">Template library</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Reuse a template your organisation has already set up for a donor.</p>
      </div>
      {error && <InlineAlert tone="danger" title={error} />}
      <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{t.templateName}</span>
              <span className="text-slate-500 dark:text-slate-400"> · {t.donorName} · {t.sections} section(s)</span>
            </span>
            <Button type="button" size="sm" variant="secondary" pending={busy === t.id} disabled={busy !== null} onClick={() => adopt(t.id)}>Use in this project</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
