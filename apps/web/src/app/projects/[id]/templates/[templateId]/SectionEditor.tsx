"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

type Section = { id?: string; title: string; description: string; inputType: string; required: boolean; evidenceNeeded: string };

export function SectionEditor({ projectId, templateId, initialSections }: { projectId: string; templateId: string; initialSections: Section[] }) {
  const [sections, setSections] = useState<Section[]>(initialSections ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<Section>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function add() {
    setSections((s) => [...s, { id: crypto.randomUUID(), title: "New section", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" }]);
  }
  function remove(i: number) {
    setSections((s) => s.filter((_, idx) => idx !== i));
  }
  async function save() {
    const token = getSessionToken();
    if (!token) return;
    setBusy(true); setSaved(false);
    try {
      await api(`/v1/templates/${templateId}/sections`, {
        method: "PUT",
        token,
        body: JSON.stringify({ sections }),
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {sections.map((s, i) => (
        <div key={i} className="card">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Section title</label>
              <input className="input" value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={s.inputType} onChange={(e) => update(i, { inputType: e.target.value })}>
                {["NARRATIVE", "TABLE", "ANNEX", "INDICATOR_TABLE", "COMPLIANCE"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.required} onChange={(e) => update(i, { required: e.target.checked })} />
                Required
              </label>
              <button className="btn-danger ml-auto" type="button" onClick={() => remove(i)}>Remove</button>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" value={s.description} onChange={(e) => update(i, { description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Evidence needed</label>
              <input className="input" value={s.evidenceNeeded} onChange={(e) => update(i, { evidenceNeeded: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-3">
        <button className="btn-secondary" type="button" onClick={add}>Add section</button>
        <button className="btn" type="button" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save template"}</button>
        {saved && <span className="self-center text-sm text-green-700 dark:text-green-400">Saved</span>}
      </div>
    </div>
  );
}
