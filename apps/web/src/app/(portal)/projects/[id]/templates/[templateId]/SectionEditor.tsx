"use client";
import { useState } from "react";
import { updateTemplateSectionsAction } from "@/lib/actions/templates";
import { useActionState } from "@/lib/client/action-state";
import { SECTION_INPUT_TYPE_OPTIONS, SECTION_INPUT_TYPE_LABEL } from "@/lib/labels";
import { InlineAlert } from "@/components/feedback/InlineAlert";

type Section = { id?: string; title: string; description: string; inputType: string; required: boolean; evidenceNeeded: string; reviewStatus?: "DRAFT" | "REVIEWED"; minWords?: number; maxWords?: number };

export function SectionEditor({ projectId, templateId, initialSections }: { projectId: string; templateId: string; initialSections: Section[] }) {
  const [sections, setSections] = useState<Section[]>(initialSections ?? []);
  const { busy, error, run } = useActionState();
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<Section>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
    setSaved(false);
  }
  function add() {
    setSections((s) => [...s, { id: crypto.randomUUID(), title: "New section", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "", reviewStatus: "DRAFT" }]);
    setSaved(false);
  }
  function remove(i: number) {
    setSections((s) => s.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  async function save() {
    const result = await run(() =>
      updateTemplateSectionsAction(
        templateId,
        sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          inputType: s.inputType as "NARRATIVE" | "TABLE" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE",
          required: s.required,
          evidenceNeeded: s.evidenceNeeded,
          reviewStatus: s.reviewStatus ?? "DRAFT",
          minWords: s.minWords,
          maxWords: s.maxWords,
        })),
      ),
    );
    if (result !== undefined) setSaved(true);
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
                {SECTION_INPUT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{SECTION_INPUT_TYPE_LABEL[t]}</option>)}
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
      {error && <InlineAlert tone="danger" title={error} />}
    </div>
  );
}
