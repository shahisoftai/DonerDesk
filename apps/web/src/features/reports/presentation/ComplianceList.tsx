"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { checklistStatusTone, severityTone } from "@/lib/shared/tone";
import { CHECKLIST_STATUS_LABEL, SEVERITY_LABEL } from "@/lib/labels";

export type ComplianceRow = { id: string; projectId: string; projectTitle: string; periodId: string; title: string; description?: string; severity: string; status: string; dueDate?: string | null };

type Sort = "SEVERITY" | "DUE" | "PROJECT" | "TITLE" | "STATUS";
const SEV_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const sevLabel = (s: string) => SEVERITY_LABEL[s] ?? s;
const statusLabel = (s: string) => CHECKLIST_STATUS_LABEL[s] ?? s.replace(/_/g, " ");
const bySeverity = (a: ComplianceRow, b: ComplianceRow) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);

const SORTERS: Record<Sort, (a: ComplianceRow, b: ComplianceRow) => number> = {
  SEVERITY: (a, b) => bySeverity(a, b) || a.title.localeCompare(b.title),
  // No due date sorts last.
  DUE: (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || bySeverity(a, b),
  PROJECT: (a, b) => a.projectTitle.localeCompare(b.projectTitle) || bySeverity(a, b),
  TITLE: (a, b) => a.title.localeCompare(b.title),
  STATUS: (a, b) => statusLabel(a.status).localeCompare(statusLabel(b.status)) || bySeverity(a, b),
};

export function ComplianceList({ rows }: { rows: ComplianceRow[] }) {
  const [sort, setSort] = useState<Sort>("SEVERITY");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const projects = useMemo(() => [...new Map(rows.map((r) => [r.projectId, r.projectTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const severities = useMemo(() => [...new Set(rows.map((r) => r.severity))].sort((a, b) => (SEV_RANK[a] ?? 9) - (SEV_RANK[b] ?? 9)), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const visible = useMemo(() => rows.filter((r) => (!severity || r.severity === severity) && (!status || r.status === status) && (!projectId || r.projectId === projectId)).sort(SORTERS[sort]), [rows, severity, status, projectId, sort]);

  return <div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-500">Sort by
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="SEVERITY">Risk (most severe first)</option>
          <option value="DUE">Due date (soonest first)</option>
          <option value="PROJECT">Project</option>
          <option value="TITLE">Requirement (A–Z)</option>
          <option value="STATUS">Status</option>
        </Select>
      </label>
      <label className="text-xs text-slate-500">Severity
        <Select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">All severities</option>{severities.map((v) => <option key={v} value={v}>{sevLabel(v)}</option>)}</Select>
      </label>
      <label className="text-xs text-slate-500">Status
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}</Select>
      </label>
      <label className="text-xs text-slate-500">Project
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{projects.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</Select>
      </label>
    </div>
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">{visible.length} of {rows.length} open requirements</p>
    {visible.length === 0 ? <p className="mt-4 text-sm text-slate-500">No requirements match these filters.</p> : <div className="mt-3 space-y-3">{visible.map((r) => <Link key={r.id} href={`/projects/${r.projectId}/compliance?period=${r.periodId}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand-400/40">
      <div className="min-w-0"><div className="font-medium">{r.title}</div><div className="text-xs text-slate-500">{r.projectTitle}{r.dueDate ? ` · due ${new Date(r.dueDate).toLocaleDateString()}` : ""}{r.description ? ` · ${r.description}` : ""}</div></div>
      <div className="flex gap-2"><Badge tone={severityTone(r.severity)}>{sevLabel(r.severity)}</Badge><Badge tone={checklistStatusTone(r.status)}>{statusLabel(r.status)}</Badge></div>
    </Link>)}</div>}
  </div>;
}
