"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";

export type DownloadRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  typeKey: string;
  typeLabel: string;
  reportLabel?: string;
  reportHref?: string;
  version?: number;
  createdAt: string;
  createdLabel: string;
  href: string;
};

type Sort = "NEWEST" | "OLDEST" | "PROJECT" | "TYPE";
const SORTERS: Record<Sort, (a: DownloadRow, b: DownloadRow) => number> = {
  NEWEST: (a, b) => b.createdAt.localeCompare(a.createdAt),
  OLDEST: (a, b) => a.createdAt.localeCompare(b.createdAt),
  PROJECT: (a, b) => a.projectTitle.localeCompare(b.projectTitle) || b.createdAt.localeCompare(a.createdAt),
  TYPE: (a, b) => a.typeLabel.localeCompare(b.typeLabel) || b.createdAt.localeCompare(a.createdAt),
};

export function DownloadCenter({ rows }: { rows: DownloadRow[] }) {
  const [sort, setSort] = useState<Sort>("NEWEST");
  const [type, setType] = useState("");
  const [projectId, setProjectId] = useState("");
  const projects = useMemo(() => [...new Map(rows.map((r) => [r.projectId, r.projectTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const types = useMemo(() => [...new Map(rows.map((r) => [r.typeKey, r.typeLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const visible = useMemo(() => rows.filter((r) => (!type || r.typeKey === type) && (!projectId || r.projectId === projectId)).sort(SORTERS[sort]), [rows, type, projectId, sort]);

  return <div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-slate-500">Sort by
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="NEWEST">Newest first</option>
          <option value="OLDEST">Oldest first</option>
          <option value="PROJECT">Project name</option>
          <option value="TYPE">File type</option>
        </Select>
      </label>
      <label className="text-xs text-slate-500">File type
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </label>
      <label className="text-xs text-slate-500">Project
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </Select>
      </label>
    </div>
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">{visible.length} of {rows.length} files</p>
    {visible.length === 0 ? <p className="mt-4 text-sm text-slate-500">No downloads match these filters.</p> : <ul className="mt-3 space-y-3">{visible.map((r) => <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium">{r.title}</div>
        <div className="text-xs text-slate-500">{r.projectTitle} · {r.typeLabel}{r.reportHref ? <> · <Link className="hover:underline" href={r.reportHref}>{r.reportLabel}</Link></> : null} · Version {r.version ?? "—"} · {r.createdLabel}</div>
      </div>
      <a className="btn-secondary py-1 text-xs" href={r.href}>Download</a>
    </li>)}</ul>}
  </div>;
}
