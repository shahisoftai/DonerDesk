"use client";

import { useEffect, useState } from "react";
import { createExportAction, getExportPreflightAction } from "@/lib/actions/exports";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { EXPORT_TYPE_LABEL } from "@/lib/labels";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";
import { type ExportPreflight } from "@/lib/server/schemas";

type Step = "type" | "inclusions" | "warnings" | "result";

export function ExportWizard({
  projectId,
  periodId,
  onClose,
  onExported,
}: {
  projectId: string;
  periodId: string;
  onClose: () => void;
  onExported: () => void;
}) {
  const actionState = useActionState();
  const [preflight, setPreflight] = useState<ExportPreflight | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("type");
  const [exportType, setExportType] = useState<string>("");
  const [included, setIncluded] = useState<string[]>([]);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [result, setResult] = useState<{ id: string; fileUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getExportPreflightAction(periodId);
      if (cancelled) return;
      if (!r.ok) {
        setLoadError(r.error.message);
        return;
      }
      setPreflight(r.value);
      setExportType(r.value.exportTypes[0] ?? "");
      setIncluded(r.value.evidence.filter((e) => e.defaultIncluded).map((e) => e.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  if (loadError) {
    return (
      <div className="card">
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{loadError}</p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={onClose}>Cancel</Button>
      </div>
    );
  }
  if (!preflight) {
    return <div className="card text-sm text-slate-500 dark:text-slate-400">Loading export details…</div>;
  }

  if (preflight.blocking.length > 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Export is blocked</h3>
        <ul className="mt-2 space-y-1 text-sm text-danger-700 dark:text-danger-400">
          {preflight.blocking.map((b) => (
            <li key={b.code}>{b.message}</li>
          ))}
        </ul>
        <Button size="sm" variant="secondary" className="mt-3" onClick={onClose}>Close</Button>
      </div>
    );
  }

  function toggleIncluded(id: string) {
    setIncluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function create() {
    const r = await actionState.run(() =>
      createExportAction({
        projectId,
        reportingPeriodId: periodId,
        exportType,
        includeEvidenceIds: included,
        includeSensitive,
      }),
    );
    if (r) {
      setResult(r);
      setStep("result");
      onExported();
    }
  }

  const sensitiveFiles = preflight.evidence.filter((e) => e.confidentialityLevel === "SENSITIVE" || e.confidentialityLevel === "HIGHLY_SENSITIVE");

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Export report</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {preflight.draft && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Report version {preflight.draft.version} · {preflight.draft.status.replace(/_/g, " ")}
        </p>
      )}

      {step === "type" && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="export-type">Export type</label>
            <Select id="export-type" value={exportType} onChange={(e) => setExportType(e.target.value)}>
              {preflight.exportTypes.map((t) => (
                <option key={t} value={t}>{EXPORT_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <Button size="sm" onClick={() => setStep("inclusions")}>Next: files</Button>
        </div>
      )}

      {step === "inclusions" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Choose which evidence files to include. Sensitive files are excluded by default.
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {preflight.evidence.map((e) => {
              const isSensitive = e.confidentialityLevel === "SENSITIVE" || e.confidentialityLevel === "HIGHLY_SENSITIVE";
              const disabled = isSensitive && !includeSensitive;
              return (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                    checked={included.includes(e.id)}
                    disabled={disabled}
                    onChange={() => toggleIncluded(e.id)}
                  />
                  <span className="min-w-0 flex-1 break-words leading-snug">{e.title}</span>
                  {isSensitive && <Badge tone="danger">Sensitive</Badge>}
                </li>
              );
            })}
          </ul>
          {sensitiveFiles.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                checked={includeSensitive}
                onChange={(e) => setIncludeSensitive(e.target.checked)}
              />
              Include {sensitiveFiles.length} sensitive file(s)
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStep("type")}>Back</Button>
            <Button size="sm" onClick={() => setStep("warnings")}>Next: review</Button>
          </div>
        </div>
      )}

      {step === "warnings" && (
        <div className="mt-4 space-y-3">
          {preflight.warnings.length === 0 ? (
            <p className="text-sm text-success-700 dark:text-success-400">No warnings. Proceed with the export.</p>
          ) : (
            <ul className="space-y-1.5">
              {preflight.warnings.map((w) => (
                <li key={w.code} className="flex gap-2 text-sm">
                  <Badge tone="warning">Warning</Badge>
                  <span className="text-slate-700 dark:text-slate-200">{w.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exports are immutable snapshots of the selected report version and files.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStep("inclusions")}>Back</Button>
            <Button size="sm" onClick={create} pending={actionState.busy}>
              Create export
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-success-700 dark:text-success-400">Export created.</p>
          <a className="btn" href={protectedFileDownloadHref(result.fileUrl)}>
            Download
          </a>
          <Button size="sm" variant="secondary" onClick={onClose}>Done</Button>
        </div>
      )}

      {actionState.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </div>
  );
}
