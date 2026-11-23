"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { assignFacilitiesAction, listAssessorsAction, listFormAssignmentsAction } from "@/lib/actions/assessments";
import { downloadOfflinePackAction } from "@/lib/actions/offline";
import { useActionState } from "@/lib/client/action-state";
import type { FormAssignmentsView } from "@/lib/server/schemas-assessments";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";

const STATUS_LABEL = { TO_DO: "To do", IN_PROGRESS: "Started", DONE: "Done", NOT_VISITED: "Not visited" } as const;
const TONE = { TO_DO: "neutral", IN_PROGRESS: "warning", DONE: "success", NOT_VISITED: "danger" } as const;

/**
 * The round: which facilities are given to which assessor, how far each district has got, and who has not been visited and why. Facilities
 * already done are left as they are; the person given a facility is told in the app.
 */
export function FacilitiesTab({ formId, projectId, formName, canEdit }: { formId: string; projectId: string; formName: string; canEdit: boolean }) {
  const [data, setData] = useState<FormAssignmentsView | null>(null);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [people, setPeople] = useState<Array<{ userId: string; name: string; role: string }>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const act = useActionState();

  const load = useCallback(async () => {
    const r = await listFormAssignmentsAction(formId);
    setData(r.ok ? r.value : { assignments: [], coverage: [] });
  }, [formId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canEdit) return;
    void downloadOfflinePackAction(projectId, formName).then((r) => { if (r.ok) setFacilities(r.value.places.filter((p) => p.facility).map((p) => ({ id: p.id, name: p.name, path: p.path }))); });
    void listAssessorsAction(projectId).then((r) => { if (r.ok) setPeople(r.value.filter((p) => ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "FIELD_OFFICER"].includes(p.role))); });
  }, [canEdit, projectId, formName]);

  const taken = useMemo(() => new Map((data?.assignments ?? []).map((a) => [a.placeId, a])), [data]);
  const shown = facilities.filter((f) => !typed.trim() || `${f.name} ${f.path}`.toLowerCase().includes(typed.trim().toLowerCase())).slice(0, 80);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function assign() {
    setDone(null);
    const r = await act.run(() => assignFacilitiesAction(formId, { assignments: [...picked].map((placeId) => ({ placeId, assigneeId: who, ...(due ? { dueOn: due } : {}) })) }));
    if (r && typeof r === "object") { setDone(`${r.assigned} given${r.skippedDone ? `, ${r.skippedDone} already done and left as they are` : ""}.`); setPicked(new Set()); await load(); }
  }

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-6">
      {data.coverage.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">How far the round has got</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="py-2 pr-3">Area</th><th className="pr-3">Given</th><th className="pr-3">To do</th><th className="pr-3">Started</th><th className="pr-3">Done</th><th>Not visited</th></tr></thead>
              <tbody>{data.coverage.map((c) => <tr key={c.areaId} className="border-t border-slate-100 dark:border-slate-800"><td className="py-2 pr-3">{c.area}</td><td className="pr-3">{c.assigned}</td><td className="pr-3">{c.toDo}</td><td className="pr-3">{c.started}</td><td className="pr-3">{c.done}</td><td>{c.notVisited}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {canEdit && (
        <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <h3 className="text-base font-semibold">Give facilities to an assessor</h3>
          {facilities.length === 0 ? <p className="text-sm text-slate-500">No facility is marked yet. Mark a place as a facility on the Places page, then come back.</p> : (
            <>
              <Field label="Find a facility"><Input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {shown.map((f) => {
                  const a = taken.get(f.id);
                  return (
                    <li key={f.id}>
                      <label className="flex min-h-[44px] items-center gap-2">
                        <input type="checkbox" checked={picked.has(f.id)} disabled={a?.status === "DONE"} onChange={() => toggle(f.id)} />
                        <span className="min-w-0 break-words">{f.name} <span className="text-xs text-slate-500">{f.path}</span></span>
                        {a && <Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Assessor"><Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose…</option>{people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}</Select></Field>
                <Field label="Due (optional)"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                <Button onClick={() => void assign()} pending={act.busy} disabled={picked.size === 0 || !who}>{`Give ${picked.size || ""} to this person`.replace("  ", " ")}</Button>
              </div>
            </>
          )}
          {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
          {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-base font-semibold">Facilities given</h3>
        {data.assignments.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <ul className="space-y-1 text-sm">
            {data.assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.placeName}</span><span className="text-xs text-slate-500">{a.path}</span>
                <Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                {a.dueOn && <span className="text-xs text-slate-500">due {a.dueOn}</span>}
                {a.reason && <span className="text-xs text-slate-500">— {a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
