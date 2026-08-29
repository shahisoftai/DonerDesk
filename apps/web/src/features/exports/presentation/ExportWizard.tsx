"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createExportAction, getExportPreflightAction } from "@/lib/actions/exports";
import { resolveReportClaimAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { EXPORT_TYPE_LABEL } from "@/lib/labels";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";
import { type ExportPreflight, type ExportPreflightItem } from "@/lib/server/schemas";

type Step = "type" | "inclusions" | "warnings" | "result";

/**
 * Human-readable category labels for the GateKind values that the export
 * wizard surfaces. Other kinds fall back to their raw value.
 */
const GATE_KIND_LABEL: Record<string, string> = {
  NUMERIC_CONTRADICTION: "Numeric contradictions",
  UNSUPPORTED_MATERIAL_CLAIM: "Unsupported material claims",
  EVIDENCE_HASH_MISMATCH: "Evidence hash mismatches",
  ASSERTION_COVERAGE_GAP: "Assertion coverage gaps",
  VERIFICATION_STALE: "Stale verifications",
  CONFIDENTIALITY_VIOLATION: "Confidentiality violations",
  REQUIREMENT_UNSATISFIED: "Unsatisfied requirements",
};

function gateKindLabel(kind: string): string {
  return GATE_KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

export function ExportWizard({
  projectId,
  periodId,
  canResolveClaim,
  canOverrideConfidential,
  onClose,
  onExported,
}: {
  projectId: string;
  periodId: string;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
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

  async function refreshPreflight() {
    const r = await getExportPreflightAction(periodId);
    if (!r.ok) {
      setLoadError(r.error.message);
      return;
    }
    setPreflight(r.value);
  }

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
      <ExportBlockedView
        items={preflight.blockingItems}
        headline={preflight.blocking}
        canResolveClaim={canResolveClaim}
        canOverrideConfidential={canOverrideConfidential}
        onClose={onClose}
        onResolved={refreshPreflight}
      />
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
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Export report</h3>
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
                  <span className="min-w-0 flex-1 break-words leading-5">{e.title}</span>
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

/**
 * Renders the "Export is blocked" panel. The top-level summary lists each
 * blocking category; expanding one shows every individual issue with a link
 * to the page where the user can fix it and, when the user has the right
 * capability, an "Override" button that accepts the claim with a limitation
 * or excludes it from the export.
 */
function ExportBlockedView({
  items,
  headline,
  canResolveClaim,
  canOverrideConfidential,
  onClose,
  onResolved,
}: {
  items: ExportPreflightItem[];
  headline: Array<{ code: string; message: string }>;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  onClose: () => void;
  onResolved: () => Promise<void>;
}) {
  // Group items by kind so the user can collapse/expand each category.
  const groups = useMemo(() => {
    const map = new Map<string, ExportPreflightItem[]>();
    for (const item of items) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  // Auto-open the first group so users immediately see "click to expand" works.
  const [openKinds, setOpenKinds] = useState<Set<string>>(() => new Set(groups[0] ? [groups[0][0]] : []));
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Export is blocked</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {headline.length} blocking {headline.length === 1 ? "category" : "categories"} · {items.length} specific {items.length === 1 ? "issue" : "issues"} to resolve or fix.
      </p>

      <ul className="mt-3 space-y-2">
        {groups.map(([kind, group]) => {
          const open = openKinds.has(kind);
          return (
            <li key={kind} className="rounded-md border border-danger-200/60 dark:border-danger-500/30">
              <button
                type="button"
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-danger-700 dark:text-danger-400"
                onClick={() => {
                  setOpenKinds((prev) => {
                    const next = new Set(prev);
                    if (next.has(kind)) next.delete(kind);
                    else next.add(kind);
                    return next;
                  });
                }}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                  {gateKindLabel(kind)}
                </span>
                <Badge tone="danger">{group.length}</Badge>
              </button>
              {open && (
                <ul className="space-y-2 border-t border-danger-200/40 px-3 py-2 dark:border-danger-500/20">
                  {group.map((item) => (
                    <ExportIssueRow
                      key={item.id}
                      item={item}
                      canResolveClaim={canResolveClaim}
                      canOverrideConfidential={canOverrideConfidential}
                      resolving={resolving === item.id}
                      error={resolving === item.id ? resolveError : null}
                      onStartResolve={() => {
                        setResolving(item.id);
                        setResolveError(null);
                      }}
                      onCancelResolve={() => {
                        setResolving(null);
                        setResolveError(null);
                      }}
                      onResolve={async (resolution, notes) => {
                        if (!item.claimId) return;
                        setResolving(item.id);
                        setResolveError(null);
                        const r = await resolveReportClaimAction(item.claimId, { resolution, notes });
                        if (!r.ok) {
                          setResolveError(r.error.message);
                          return;
                        }
                        setResolving(null);
                        await onResolved();
                      }}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/**
 * One specific blocker issue. Shows the message, a "Fix" link to the
 * navigateTo target when available, and (when the user has the right
 * capability and the issue is claim-scoped) an "Override" button that opens
 * an inline form for ACCEPT_WITH_LIMITATION or EXCLUDE.
 */
function ExportIssueRow({
  item,
  canResolveClaim,
  canOverrideConfidential,
  resolving,
  error,
  onStartResolve,
  onCancelResolve,
  onResolve,
}: {
  item: ExportPreflightItem;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  resolving: boolean;
  error: string | null;
  onStartResolve: () => void;
  onCancelResolve: () => void;
  onResolve: (resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED", notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const overrideCapable =
    (item.resolution === "ACCEPT_WITH_LIMITATION" && canResolveClaim) ||
    (item.resolution === "EXCLUDE" && (canOverrideConfidential || canResolveClaim));

  return (
    <li className="rounded-md bg-danger-50/60 p-2 text-sm dark:bg-danger-500/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-slate-800 dark:text-slate-100">{item.message}</p>
          {item.navigateTo && (
            <Link
              href={item.navigateTo}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Fix this →
            </Link>
          )}
          {!item.navigateTo && item.resolution === "NONE" && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No direct fix link — resolve in the report workspace.
            </p>
          )}
        </div>
        {overrideCapable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (resolving) onCancelResolve();
              else onStartResolve();
            }}
          >
            {resolving ? "Cancel" : "Override"}
          </Button>
        )}
      </div>
      {resolving && (
        <div className="mt-2 space-y-2">
          {item.resolution === "ACCEPT_WITH_LIMITATION" && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Accept this claim with a written limitation. The claim remains in the report but is
              flagged as approved-with-caveat.
            </p>
          )}
          {item.resolution === "EXCLUDE" && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Exclude this claim from the export. {canOverrideConfidential
                ? "You have the grants-level authority required for confidential sources."
                : canResolveClaim
                ? "This claim does not cite a confidential source, so a project manager override is sufficient."
                : ""}
            </p>
          )}
          <label className="block text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Notes {item.resolution === "ACCEPT_WITH_LIMITATION" ? "(required)" : "(optional)"}
            </span>
            <textarea
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                item.resolution === "ACCEPT_WITH_LIMITATION"
                  ? "Why is this claim acceptable despite the issue?"
                  : "Reason for exclusion (optional)"
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={onCancelResolve}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                const resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED" =
                  item.resolution === "ACCEPT_WITH_LIMITATION" ? "ACCEPTED_WITH_LIMITATION" : "EXCLUDED";
                onResolve(resolution, notes.trim() || undefined);
              }}
              disabled={item.resolution === "ACCEPT_WITH_LIMITATION" && notes.trim().length === 0}
            >
              {item.resolution === "ACCEPT_WITH_LIMITATION" ? "Accept with limitation" : "Exclude claim"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-danger-700 dark:text-danger-400">{error}</p>
          )}
        </div>
      )}
      {!resolving && error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-700 dark:text-danger-400">{error}</p>
      )}
    </li>
  );
}
