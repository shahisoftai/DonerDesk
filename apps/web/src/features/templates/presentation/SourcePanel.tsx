"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { reextractTemplateAction } from "@/lib/actions/templates";

/** The uploaded original, the text extraction worked from, and re-extraction from corrected text. */
export function SourcePanel({
  templateId,
  originalFile,
  rawText,
  readOnly,
}: {
  templateId: string;
  originalFile?: { name?: string; available: boolean };
  rawText?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(rawText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = text !== (rawText ?? "");

  async function reextract(mode: "merge" | "replace") {
    setBusy(true);
    setError(null);
    const r = await reextractTemplateAction(templateId, { mode, rawText: changed ? text : undefined });
    setBusy(false);
    if (!r.ok) setError(r.error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">Original file</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {originalFile?.available ? originalFile.name ?? "Uploaded file" : "No file was uploaded (text was pasted)."}
          </div>
        </div>
        {originalFile?.available && (
          <a className="btn btn-secondary" href={`/api/donor-templates/${encodeURIComponent(templateId)}/original`}>
            Download original
          </a>
        )}
      </div>
      <div className="card space-y-3">
        <div>
          <div className="font-medium">Template text</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Correct the text (e.g. a badly scanned PDF) and extract again. &ldquo;Merge&rdquo; keeps sections you have reviewed; &ldquo;Replace&rdquo; starts over.
            {originalFile?.available && !changed ? " When the text is unchanged, the original file's layout is used." : ""}
          </p>
        </div>
        <Textarea aria-label="Template text" className="min-h-[18rem] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} disabled={readOnly} />
        {error && <InlineAlert tone="danger" title={error} />}
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => reextract("merge")} pending={busy} disabled={busy || !text.trim()}>Re-extract (merge)</Button>
            <Button type="button" variant="danger" onClick={() => reextract("replace")} pending={busy} disabled={busy || !text.trim()}>Re-extract (replace)</Button>
          </div>
        )}
      </div>
    </div>
  );
}
