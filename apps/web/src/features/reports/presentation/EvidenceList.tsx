"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { verificationStatusTone, confidentialityTone } from "@/lib/shared/tone";
import { EVIDENCE_TYPE_LABEL, EVIDENCE_VERIFICATION_LABEL, CONFIDENTIALITY_LABEL } from "@/lib/labels";

export type EvidenceRow = { id: string; projectId?: string; projectTitle: string; title: string; fileName: string; evidenceType: string; verificationStatus: string; confidentialityLevel: string };

type Sort = "TITLE" | "TITLE_DESC" | "PROJECT" | "TYPE" | "VERIFICATION" | "CONFIDENTIALITY";
const human = (s: string) => s.replace(/_/g, " ");
const typeLabel = (t: string) => EVIDENCE_TYPE_LABEL[t] ?? human(t);
const verLabel = (t: string) => EVIDENCE_VERIFICATION_LABEL[t] ?? human(t);
const confLabel = (t: string) => CONFIDENTIALITY_LABEL[t] ?? human(t);
// Pending review first: it is the queue's reason to exist.
const VER_RANK: Record<string, number> = { PENDING: 0, REJECTED: 1, VERIFIED: 2 };

const SORTERS: Record<Sort, (a: EvidenceRow, b: EvidenceRow) => number> = {
  TITLE: (a, b) => a.title.localeCompare(b.title),
  TITLE_DESC: (a, b) => b.title.localeCompare(a.title),
  PROJECT: (a, b) => a.projectTitle.localeCompare(b.projectTitle) || a.title.localeCompare(b.title),
  TYPE: (a, b) => typeLabel(a.evidenceType).localeCompare(typeLabel(b.evidenceType)) || a.title.localeCompare(b.title),
  VERIFICATION: (a, b) => (VER_RANK[a.verificationStatus] ?? 9) - (VER_RANK[b.verificationStatus] ?? 9) || a.title.localeCompare(b.title),
  CONFIDENTIALITY: (a, b) => confLabel(a.confidentialityLevel).localeCompare(confLabel(b.confidentialityLevel)) || a.title.localeCompare(b.title),
};

export function EvidenceList({ rows }: { rows: EvidenceRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("VERIFICATION");
  const [ver, setVer] = useState("");
  const [type, setType] = useState("");
  const [conf, setConf] = useState("");
  const [projectId, setProjectId] = useState("");
  const uniq = (f: (r: EvidenceRow) => string) => [...new Set(rows.map(f))].sort();
  const projects = useMemo(() => [...new Map(rows.filter((r) => r.projectId).map((r) => [r.projectId!, r.projectTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (!ver || r.verificationStatus === ver) && (!type || r.evidenceType === type) && (!conf || r.confidentialityLevel === conf) && (!projectId || r.projectId === projectId)
      && (!needle || r.title.toLowerCase().includes(needle) || r.fileName.toLowerCase().includes(needle))).sort(SORTERS[sort]);
  }, [rows, q, ver, type, conf, projectId, sort]);

  return <div>
    <div className="card mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-medium text-slate-500 sm:col-span-2 lg:col-span-3">Search
        <input className="input mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or file name" />
      </label>
      <label className="text-xs font-medium text-slate-500">Sort by
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="VERIFICATION">Verification (pending first)</option>
          <option value="TITLE">Title (A–Z)</option>
          <option value="TITLE_DESC">Title (Z–A)</option>
          <option value="PROJECT">Project</option>
          <option value="TYPE">Evidence type</option>
          <option value="CONFIDENTIALITY">Confidentiality</option>
        </Select>
      </label>
      <label className="text-xs font-medium text-slate-500">Verification
        <Select value={ver} onChange={(e) => setVer(e.target.value)}><option value="">All states</option>{uniq((r) => r.verificationStatus).map((v) => <option key={v} value={v}>{verLabel(v)}</option>)}</Select>
      </label>
      <label className="text-xs font-medium text-slate-500">Evidence type
        <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{uniq((r) => r.evidenceType).map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}</Select>
      </label>
      <label className="text-xs font-medium text-slate-500">Confidentiality
        <Select value={conf} onChange={(e) => setConf(e.target.value)}><option value="">All levels</option>{uniq((r) => r.confidentialityLevel).map((v) => <option key={v} value={v}>{confLabel(v)}</option>)}</Select>
      </label>
      <label className="text-xs font-medium text-slate-500">Project
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{projects.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</Select>
      </label>
    </div>
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">{visible.length} of {rows.length} files</p>
    {visible.length === 0 ? <p className="mt-4 text-sm text-slate-500">No evidence matches these filters.</p> : <div className="table-shell mt-3 overflow-x-auto">
      <table className="w-full text-sm"><caption className="sr-only">Evidence across accessible projects</caption>
        <thead className="thead"><tr><th className="px-4 py-3 text-left">Evidence</th><th className="px-4 py-3 text-left">Project</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Verification</th><th className="px-4 py-3 text-left">Confidentiality</th></tr></thead>
        <tbody>{visible.map((item) => <tr className="trow" key={item.id}>
          <td className="px-4 py-3">{item.projectId ? <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${item.projectId}/evidence/${item.id}`}>{item.title}</Link> : <span className="font-medium">{item.title}</span>}<span className="block text-xs text-slate-500">{item.fileName}</span></td>
          <td className="px-4 py-3">{item.projectTitle || "—"}</td>
          <td className="px-4 py-3">{typeLabel(item.evidenceType)}</td>
          <td className="px-4 py-3"><Badge tone={verificationStatusTone(item.verificationStatus)}>{verLabel(item.verificationStatus)}</Badge></td>
          <td className="px-4 py-3"><Badge tone={confidentialityTone(item.confidentialityLevel)}>{confLabel(item.confidentialityLevel)}</Badge></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
