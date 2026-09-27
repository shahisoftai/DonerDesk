"use client";

import { useEffect, useState } from "react";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Spinner } from "@/components/ui/Spinner";
import { getTemplateBriefPreviewAction } from "@/lib/actions/templates";

type Preview = { version: number; template: string; sections: Array<{ templateSectionId: string; title: string; brief: string }> };

/** Exactly what the AI writer is told, per section, for the saved version. */
export function BriefPreview({ templateId, version }: { templateId: string; version: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPreview(null);
    getTemplateBriefPreviewAction(templateId).then((r) => {
      if (!live) return;
      if (r.ok) setPreview(r.value);
      else setError(r.error.message);
    });
    return () => {
      live = false;
    };
  }, [templateId, version]);

  if (error) return <InlineAlert tone="danger" title={error} />;
  if (!preview) return <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Loading preview…</div>;
  return (
    <div className="space-y-3">
      <InlineAlert tone="info" title={`Preview of version ${preview.version}`}>
        This is the donor guidance the AI writer receives with each section, alongside your verified data. Save your edits to update it.
      </InlineAlert>
      {preview.template && (
        <details className="card" open>
          <summary className="cursor-pointer font-medium">Whole report</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">{preview.template}</pre>
        </details>
      )}
      {preview.sections.map((s) => (
        <details key={s.templateSectionId} className="card">
          <summary className="cursor-pointer font-medium">{s.title}</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">{s.brief}</pre>
        </details>
      ))}
    </div>
  );
}
