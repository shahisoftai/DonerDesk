"use client";

import { useEffect, useState, useTransition } from "react";
import type { DraftPerson } from "@donordesk/domain";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { getProjectTeamForCopyAction, listProjectsForTeamCopyAction } from "@/lib/actions/setup-team-sources";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { TEAM_ROLES, addPersonOperation } from "../domain/team-view";
import { usePcwCopy } from "./usePcwCopy";

/** Option 3 on the team step: bring over another project's active members. Only people not yet named are added; roles outside the offered list become Viewer (never more access than the person had). */
export function CopyTeamFromProject({ id, team, onView, onError }: { id: string; team: readonly DraftPerson[]; onView: (v: SetupDraftView) => void; onError: (m: string | null) => void }) {
  const t = usePcwCopy().c.team;
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [chosen, setChosen] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { void listProjectsForTeamCopyAction().then((r) => { if (r.ok) setProjects(r.value); }); }, []);
  if (projects.length === 0) return null;

  const copy = () => startTransition(async () => {
    onError(null); setNote(null);
    const members = await getProjectTeamForCopyAction(chosen);
    if (!members.ok) return onError(members.error.message);
    let current = [...team];
    let added = 0;
    for (const m of members.value) {
      if (current.some((p) => (p.email ?? "").toLowerCase() === m.email.toLowerCase())) continue;
      const role = (TEAM_ROLES as readonly string[]).includes(m.role) ? m.role : "VIEWER";
      const built = addPersonOperation(current, { name: m.name, email: m.email, role, external: false, invite: "NOW" });
      if (!built.ok) continue;
      const r = await editDraftAction(id, built.operation);
      if (!r.ok) return onError(r.error.message);
      current = r.value.extras.team; added += 1; onView(r.value);
    }
    setNote(t.copyDone(added));
  });

  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-2 dark:border-white/20">
      <h3 className="text-sm font-semibold sm:col-span-2">{t.copyTitle}</h3>
      <Field label={t.copyFrom}>
        <Select value={chosen} onChange={(e) => setChosen(e.target.value)}>
          <option value="">{t.copyChoose}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="flex items-end"><button type="button" className="btn" disabled={pending || !chosen} onClick={copy}>{t.copyAdd}</button></div>
      {note ? <p role="status" className="text-xs text-slate-600 sm:col-span-2 dark:text-slate-300">{note}</p> : null}
    </div>
  );
}
