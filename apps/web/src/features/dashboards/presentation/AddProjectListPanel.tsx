"use client";

import { useState } from "react";
import { PROJECT_LIST_AFFILIATIONS, PROJECT_LIST_AFFILIATION_LABEL, type ProjectListAffiliation, type ProjectListQuery } from "@donordesk/domain/contexts/dashboards/project-list.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATUSES = ["ACTIVE", "DRAFT", "PAUSED", "COMPLETED", "CLOSED"] as const;

/**
 * While editing: add a list of projects (after DevResults' Project List tile). It stores only the filter; the list is made when the dashboard is opened, for the person
 * opening it, so "projects I am assigned to" shows each viewer their own. A share link shows none.
 */
export function AddProjectListPanel({ projects, onAdd, full, edit }: {
  projects: Record<string, string>;
  onAdd: (projectId: string, q: ProjectListQuery) => void;
  full: boolean;
  edit?: { initial: ProjectListQuery; onApply: (q: ProjectListQuery) => void; onCancel: () => void };
}) {
  const ids = Object.keys(projects);
  const [projectId, setProjectId] = useState(ids[0] ?? "");
  const [status, setStatus] = useState(edit?.initial.status ?? "");
  const [sector, setSector] = useState(edit?.initial.sector ?? "");
  const [affiliation, setAffiliation] = useState<ProjectListAffiliation>(edit?.initial.affiliation ?? "ALL");
  const [title, setTitle] = useState(edit?.initial.title ?? "");
  if (!edit && ids.length === 0) return null;
  return (
    <form aria-label={edit ? "Change this project list" : "Add a project list"} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10"
      onSubmit={(e) => { e.preventDefault(); const q: ProjectListQuery = { affiliation, ...(status ? { status } : {}), ...(sector.trim() ? { sector: sector.trim() } : {}), ...(title.trim() ? { title: title.trim() } : {}) }; if (edit) edit.onApply(q); else onAdd(projectId, q); }}>
      <h3 className="text-sm font-medium">{edit ? "Change this project list" : "Add a project list"}</h3>
      <p className="text-xs text-slate-500">Shows the projects each viewer can see. It is made when the dashboard is opened, so it is always current.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {!edit && <Field label="Project"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{ids.map((id) => <option key={id} value={id}>{projects[id]}</option>)}</Select></Field>}
        <Field label="Which projects"><Select value={affiliation} onChange={(e) => setAffiliation(e.target.value as ProjectListAffiliation)}>{PROJECT_LIST_AFFILIATIONS.map((a) => <option key={a} value={a}>{PROJECT_LIST_AFFILIATION_LABEL[a]}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</Select></Field>
        <Field label="Sector (optional)"><Input value={sector} maxLength={60} onChange={(e) => setSector(e.target.value)} /></Field>
        <Field label="Name (optional)"><Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!edit && (full || !projectId)}>{edit ? "Apply" : "Add the list"}</Button>
        {edit && <Button type="button" variant="secondary" onClick={edit.onCancel}>Cancel</Button>}
        {!edit && full && <span className="text-xs text-slate-500">This dashboard is full.</span>}
      </div>
    </form>
  );
}
