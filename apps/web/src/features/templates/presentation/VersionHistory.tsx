"use client";

import { useState } from "react";
import { diffTemplateVersions, type TemplateVersionDiff } from "@donordesk/domain/contexts/templates/template-diff.js";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { getTemplateVersionAction } from "@/lib/actions/templates";

type Version = { version: number; createdAt: string; createdById: string; changeNote?: string };

const FIELD_LABELS: Record<string, string> = {
  mandatoryQuestions: "questions",
  evidenceNeeded: "evidence",
  requiredTables: "tables",
  inputType: "content type",
  includeInReport: "included in report",
  authorInstructions: "organisation guidance",
  reviewStatus: "review status",
  parentId: "position",
  relatedLogframeElement: "logframe link",
};

/** Version list with a field-level comparison between any two versions. */
export function VersionHistory({ templateId, versions }: { templateId: string; versions: Version[] }) {
  const [from, setFrom] = useState(versions[1]?.version ?? versions[0]?.version ?? 1);
  const [to, setTo] = useState(versions[0]?.version ?? 1);
  const [diff, setDiff] = useState<TemplateVersionDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function compare() {
    setBusy(true);
    setError(null);
    const [a, b] = await Promise.all([getTemplateVersionAction(templateId, from), getTemplateVersionAction(templateId, to)]);
    setBusy(false);
    if (!a.ok || !b.ok) {
      setError((!a.ok ? a.error.message : !b.ok ? b.error.message : "") || "Could not load versions");
      return;
    }
    setDiff(diffTemplateVersions(a.value as never, b.value as never));
  }

  return (
    <div className="space-y-4">
      <ol className="card divide-y divide-slate-100 !p-0 text-sm dark:divide-white/5">
        {versions.map((v) => (
          <li key={v.version} className="flex items-center justify-between px-4 py-2">
            <span className="font-medium">Version {v.version}</span>
            <span className="text-slate-500 dark:text-slate-400">{v.changeNote ?? "Saved"} · {new Date(v.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ol>
      {versions.length > 1 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Compare
            <Select aria-label="From version" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
              {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
            </Select>
            with
            <Select aria-label="To version" value={to} onChange={(e) => setTo(Number(e.target.value))}>
              {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
            </Select>
            <Button type="button" size="sm" onClick={compare} pending={busy} disabled={from === to}>Compare</Button>
          </div>
          {error && <InlineAlert tone="danger" title={error} />}
          {diff && (
            <div className="space-y-2 text-sm">
              {diff.added.length + diff.removed.length + diff.changed.length === 0 && !diff.reordered && diff.requirementsChanged.length === 0 && (
                <p className="text-slate-500">No differences.</p>
              )}
              {diff.added.map((s) => <p key={`a-${s.id}`} className="text-emerald-700 dark:text-emerald-400">+ Added “{s.title}”</p>)}
              {diff.removed.map((s) => <p key={`r-${s.id}`} className="text-red-700 dark:text-red-400">− Removed “{s.title}”</p>)}
              {diff.changed.map((s) => (
                <p key={`c-${s.id}`}>~ “{s.title}”: {s.fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</p>
              ))}
              {diff.reordered && <p>↕ Sections were reordered.</p>}
              {diff.requirementsChanged.length > 0 && <p>Report requirements changed: {diff.requirementsChanged.join(", ")}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
