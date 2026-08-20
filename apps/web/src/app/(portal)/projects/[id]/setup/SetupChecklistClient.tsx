"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProjectReadiness, ProjectReadinessSnapshot } from "@/lib/server/schemas";
import { acknowledgeProjectSetupAction, retryProjectWorkspaceAction, repairProjectWorkspaceAction } from "@/lib/actions/setup";
import { Badge } from "@/components/data/Badge";
import { InlineAlert } from "@/components/feedback/InlineAlert";

type BlockerView = { code: string; label: string; href?: string; retryable?: boolean };

function toneForStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "READY": return "success";
    case "ACTION_REQUIRED": return "danger";
    case "NOT_STARTED": return "neutral";
    default: return "warning";
  }
}

export function SetupChecklistClient({
  projectId,
  initialReadiness,
  initialSnapshot,
  initiallyAcknowledged,
  canManage,
}: {
  projectId: string;
  initialReadiness: ProjectReadiness;
  initialSnapshot: ProjectReadinessSnapshot;
  initiallyAcknowledged: boolean;
  canManage: boolean;
}) {
  const [readiness, setReadiness] = useState(initialReadiness);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(fn: () => Promise<unknown>, mutate: (v: unknown) => void) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      mutate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const blockerItems: BlockerView[] = readiness.blockers;
  const ready = readiness.ready;
  const statusLabel = readiness.status.replace(/_/g, " ");

  const items: Array<{ key: string; label: string; done: boolean; href?: string; description: string }> = [
    {
      key: "workspace",
      label: "Project workspace folder",
      done: snapshot.workspace.provisionStatus === "READY" || snapshot.workspace.provisionStatus === "NOT_REQUIRED",
      description:
        snapshot.workspace.provisionStatus === "NOT_REQUIRED"
          ? "Not required for your storage provider."
          : snapshot.workspace.provisionStatus === "READY"
            ? "Folder tree ready."
            : "Being provisioned in the background.",
    },
    {
      key: "template",
      label: "Donor template",
      done: snapshot.template.exists && snapshot.template.reviewedRequiredSectionCount > 0,
      href: `/projects/${projectId}/templates`,
      description: snapshot.template.exists
        ? `${snapshot.template.reviewedRequiredSectionCount} reviewed required section(s)`
        : "No template uploaded yet.",
    },
    {
      key: "indicators",
      label: "Logframe and indicators",
      done: snapshot.indicators.total > 0 && snapshot.indicators.reportable > 0,
      href: `/projects/${projectId}/logframe`,
      description:
        snapshot.indicators.total === 0
          ? "No indicators yet."
          : `${snapshot.indicators.reportable} reportable of ${snapshot.indicators.total}.`,
    },
    {
      key: "profile",
      label: "Reporting profile",
      done: snapshot.profile.exists,
      href: `/projects/${projectId}/setup/profile`,
      description: snapshot.profile.exists
        ? `${snapshot.profile.language} · ${snapshot.profile.tone?.replace(/_/g, " ").toLowerCase()}`
        : "No profile configured.",
    },
    {
      key: "team",
      label: "Team assignment (recommended)",
      done: snapshot.team.assigned,
      href: `/projects/${projectId}/team`,
      description: snapshot.team.assigned ? "Staff assigned." : "Not required, but recommended.",
    },
  ];

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Setup status</h3>
          <Badge tone={toneForStatus(readiness.status)}>{statusLabel}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {ready
            ? "Your project is ready for reporting. You can create reporting periods."
            : `${blockerItems.length} item${blockerItems.length === 1 ? "" : "s"} still need attention.`}
        </p>
        {error && <InlineAlert tone="danger" title={error} />}
      </section>

      <ul className="space-y-3" aria-label="Project setup checklist">
        {items.map((item) => (
          <li key={item.key} className="card flex items-start gap-3">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                item.done ? "bg-success-500 text-white" : "border border-slate-300 text-slate-400 dark:border-white/15"
              }`}
              aria-hidden="true"
            >
              {item.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.label}</p>
                {item.done ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Todo</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
            </div>
            {item.href && !item.done && canManage && (
              <Link className="btn-secondary text-sm" href={item.href}>Set up</Link>
            )}
          </li>
        ))}
      </ul>

      <section className="card">
        <h3 className="font-medium">Blockers</h3>
        {blockerItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No blockers. Your project is ready to report.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blockerItems.map((b) => (
              <li key={b.code} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <span className="font-mono text-xs text-slate-500">{b.code}</span>
                  <p className="text-slate-700 dark:text-slate-200">{b.label}</p>
                </div>
                {b.href && canManage && <Link className="btn-secondary text-sm shrink-0" href={b.href}>Fix</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <div className="flex flex-wrap gap-3">
          {ready && !acknowledged && (
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(() => acknowledgeProjectSetupAction(projectId), (v) => {
                  const result = v as { acknowledged: boolean } | { ok: boolean };
                  if ("ok" in result && !result.ok) return;
                  setAcknowledged(true);
                })
              }
            >
              {busy ? "Saving..." : "Mark setup complete"}
            </button>
          )}
          {acknowledged && <Badge tone="success">Setup acknowledged</Badge>}
          <button
            className="btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              runAction(() => retryProjectWorkspaceAction(projectId), (v) => {
                const result = v as { provisionStatus: string } | { ok: boolean };
                if ("ok" in result && !result.ok) return;
                setSnapshot((s) => ({ ...s, workspace: { ...s.workspace, provisionStatus: "IN_PROGRESS" } }));
              })
            }
          >
            Retry workspace
          </button>
          <button
            className="btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              runAction(() => repairProjectWorkspaceAction(projectId), (v) => {
                const result = v as { provisionStatus: string } | { ok: boolean };
                if ("ok" in result && !result.ok) return;
                setSnapshot((s) => ({ ...s, workspace: { ...s.workspace, provisionStatus: "READY" } }));
              })
            }
          >
            Repair workspace
          </button>
        </div>
      )}
    </div>
  );
}
