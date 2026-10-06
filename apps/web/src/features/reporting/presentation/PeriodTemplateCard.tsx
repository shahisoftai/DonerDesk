"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changePeriodTemplateAction } from "@/lib/actions/reporting";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

export interface TemplateChoice {
  id: string;
  name: string;
  reportType: string;
  approved: boolean;
}

/** Shows which template a report follows and changes it. Changing never regenerates: it says when that is needed. */
export function PeriodTemplateCard({
  periodId,
  projectId,
  currentTemplateId,
  templates,
  canEdit,
  lockedReason,
}: {
  periodId: string;
  projectId: string;
  currentTemplateId: string | null;
  templates: TemplateChoice[];
  canEdit: boolean;
  lockedReason?: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(currentTemplateId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [regenerate, setRegenerate] = useState(false);
  const current = templates.find((t) => t.id === currentTemplateId);

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await changePeriodTemplateAction(periodId, choice || null);
    setBusy(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error.message });
    setRegenerate(result.value.regenerateNeeded);
    setMessage({ tone: "ok", text: result.value.changed ? "Template changed." : "Already using that template." });
    router.refresh();
  }

  return (
    <section className="card mt-4" aria-labelledby="period-template-heading">
      <h3 id="period-template-heading" className="font-medium">Template</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {current ? <>This report follows <strong>{current.name}</strong>{current.approved ? " ✓" : " (not approved yet)"}.</> : "This report uses the built-in structure for its type."}
        {!templates.length && <> <Link className="underline" href={`/projects/${projectId}/templates`}>Add a template</Link> to use the donor&apos;s own sections.</>}
      </p>
      {canEdit && templates.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select aria-label="Template for this report" value={choice} onChange={(e) => setChoice(e.target.value)} disabled={busy || Boolean(lockedReason)} className="max-w-sm">
            <option value="">Built-in structure (no template)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.approved}>{t.name}{t.approved ? "" : " (not approved yet)"}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={() => void save()} pending={busy} disabled={busy || Boolean(lockedReason) || choice === (currentTemplateId ?? "")}>Change template</Button>
        </div>
      )}
      {lockedReason && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{lockedReason}</p>}
      {message && (message.tone === "error"
        ? <div className="mt-3"><InlineAlert tone="danger" title={message.text} /></div>
        : <p role="status" className="mt-3 text-sm text-success-700 dark:text-success-400">{message.text}</p>)}
      {regenerate && (
        <p role="status" className="mt-2 text-sm">
          The report was already drafted. <Link className="underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link> and regenerate it to use the new template.
        </p>
      )}
    </section>
  );
}
