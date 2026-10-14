"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from "@/lib/labels";
import { reportStatusTone } from "@/lib/shared/tone";
import { deadlineUrgency, formatDate } from "@/lib/shared/dates";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";

export type ReportDownload = { label: string; href: string };
export type ReportRow = {
  projectId: string;
  projectTitle: string;
  periodId: string;
  reportType: string;
  status: string;
  readinessScore: number;
  deadline: string;
  startDate: string;
  daysUntilDeadline: number;
  downloads: ReportDownload[];
};

const COMPLETED = new Set(["APPROVED", "SUBMITTED", "CLOSED"]);
const isCompleted = (r: ReportRow) => COMPLETED.has(r.status);

type Filter = "ALL" | "DUE" | "OVERDUE" | "COMPLETED" | "DOWNLOADABLE";
type Sort = "DEADLINE_ASC" | "DEADLINE_DESC" | "READINESS_DESC" | "READINESS_ASC" | "PROJECT" | "PERIOD_DESC";
type Group = "NONE" | "PROJECT" | "STATUS" | "TYPE";

const SORTERS: Record<Sort, (a: ReportRow, b: ReportRow) => number> = {
  DEADLINE_ASC: (a, b) => a.daysUntilDeadline - b.daysUntilDeadline,
  DEADLINE_DESC: (a, b) => b.daysUntilDeadline - a.daysUntilDeadline,
  READINESS_DESC: (a, b) => b.readinessScore - a.readinessScore,
  READINESS_ASC: (a, b) => a.readinessScore - b.readinessScore,
  PROJECT: (a, b) => a.projectTitle.localeCompare(b.projectTitle) || a.daysUntilDeadline - b.daysUntilDeadline,
  PERIOD_DESC: (a, b) => b.startDate.localeCompare(a.startDate),
};

const statusLabel = (s: string) => REPORT_STATUS_LABEL[s] ?? s.replace(/_/g, " ");
const typeLabel = (t: string) => REPORT_TYPE_LABEL[t] ?? t;

function groupKey(r: ReportRow, g: Group): string {
  if (g === "PROJECT") return r.projectTitle;
  if (g === "STATUS") return isCompleted(r) ? "Completed" : "Due / in progress";
  if (g === "TYPE") return typeLabel(r.reportType);
  return "";
}

export function ReportsList({ rows }: { rows: ReportRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("DEADLINE_ASC");
  const [group, setGroup] = useState<Group>("PROJECT");
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState("");

  const projects = useMemo(() => [...new Map(rows.map((r) => [r.projectId, r.projectTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.reportType))], [rows]);

  const visible = useMemo(() => {
    const list = rows.filter((r) => {
      if (projectId && r.projectId !== projectId) return false;
      if (type && r.reportType !== type) return false;
      if (filter === "DUE") return !isCompleted(r);
      if (filter === "OVERDUE") return !isCompleted(r) && r.daysUntilDeadline < 0;
      if (filter === "COMPLETED") return isCompleted(r);
      if (filter === "DOWNLOADABLE") return r.downloads.length > 0;
      return true;
    });
    // Within a list, finished reports sink below open ones when sorting by deadline so "due" work leads.
    return [...list].sort(SORTERS[sort]);
  }, [rows, filter, sort, projectId, type]);

  const groups = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const r of visible) {
      const k = groupKey(r, group);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    const entries = [...map.entries()];
    if (group === "PROJECT" || group === "TYPE") entries.sort((a, b) => a[0].localeCompare(b[0]));
    if (group === "STATUS") entries.sort((a, b) => (a[0] === "Completed" ? 1 : 0) - (b[0] === "Completed" ? 1 : 0));
    return entries;
  }, [visible, group]);

  const counts = useMemo(() => ({
    all: rows.length,
    overdue: rows.filter((r) => !isCompleted(r) && r.daysUntilDeadline < 0).length,
    completed: rows.filter(isCompleted).length,
    downloadable: rows.filter((r) => r.downloads.length > 0).length,
  }), [rows]);

  const chips: Array<[Filter, string]> = [
    ["ALL", `All (${counts.all})`],
    ["DUE", `Due (${counts.all - counts.completed})`],
    ["OVERDUE", `Overdue (${counts.overdue})`],
    ["COMPLETED", `Completed (${counts.completed})`],
    ["DOWNLOADABLE", `Ready to download (${counts.downloadable})`],
  ];

  return <div>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter reports">
      {chips.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${filter === value ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300" : "border-slate-300 text-slate-600 hover:border-brand-400/50 dark:border-white/10 dark:text-slate-300"}`}>{label}</button>)}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-500">Sort by
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="DEADLINE_ASC">Deadline: soonest first</option>
          <option value="DEADLINE_DESC">Deadline: latest first</option>
          <option value="READINESS_ASC">Readiness: lowest first</option>
          <option value="READINESS_DESC">Readiness: highest first</option>
          <option value="PROJECT">Project name</option>
          <option value="PERIOD_DESC">Reporting period: newest first</option>
        </Select>
      </label>
      <label className="text-xs text-slate-500">Group by
        <Select value={group} onChange={(e) => setGroup(e.target.value as Group)}>
          <option value="PROJECT">Project</option>
          <option value="STATUS">Due / completed</option>
          <option value="TYPE">Report type</option>
          <option value="NONE">No grouping</option>
        </Select>
      </label>
      <label className="text-xs text-slate-500">Project
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </Select>
      </label>
      <label className="text-xs text-slate-500">Report type
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </Select>
      </label>
    </div>

    {visible.length === 0 ? <p className="mt-6 text-sm text-slate-500">No reports match these filters.</p> : groups.map(([name, items]) => <section key={name || "all"} className="mt-6" aria-label={name || "Reports"}>
      {name && <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{name} <span className="font-normal text-slate-400">({items.length})</span></h2>}
      <div className="space-y-3">{items.map((r) => {
        const done = isCompleted(r);
        const urgency = deadlineUrgency(r.daysUntilDeadline);
        return <div key={r.periodId} className="card grid gap-3 transition hover:border-brand-400/40 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <Link href={`/projects/${r.projectId}/reports/${r.periodId}`} className="min-w-0">
            <div className="font-medium">{r.projectTitle}</div>
            <div className="text-xs text-slate-500">{typeLabel(r.reportType)} · {formatDate(r.startDate)} – Deadline {formatDate(r.deadline)}</div>
          </Link>
          <div><div className="text-xs text-slate-500">Readiness</div><div className="font-medium tabular-nums">{r.readinessScore}%</div></div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!done && <Badge tone={urgency.tone}>{urgency.label}</Badge>}
            <Badge tone={reportStatusTone(r.status)}>{statusLabel(r.status)}</Badge>
            {r.downloads.map((d) => <a key={d.href} href={d.href} className="btn-secondary py-1 text-xs" aria-label={`Download ${d.label} for ${r.projectTitle}`}>Download {d.label}</a>)}
          </div>
        </div>;
      })}</div>
    </section>)}
  </div>;
}

export function downloadsFor(exports: Array<{ exportType: string; fileUrl: string; fileName?: string; createdAt: string }>): ReportDownload[] {
  const latest = (t: string) => exports.filter((e) => e.exportType === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return ([["PDF", "PDF"], ["WORD", "Word"]] as const).flatMap(([t, label]) => {
    const e = latest(t);
    return e ? [{ label, href: protectedFileDownloadHref(e.fileUrl, e.fileName) }] : [];
  });
}
