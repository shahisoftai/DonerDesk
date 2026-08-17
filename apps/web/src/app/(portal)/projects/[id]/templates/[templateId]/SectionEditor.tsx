"use client";
import { useState } from "react";
import { updateTemplateSectionsAction } from "@/lib/actions/templates";
import { useActionState } from "@/lib/client/action-state";
import { SECTION_INPUT_TYPE_OPTIONS, SECTION_INPUT_TYPE_LABEL } from "@/lib/labels";
import { InlineAlert } from "@/components/feedback/InlineAlert";

type Section = { id?: string; title: string; description: string; inputType: string; required: boolean; evidenceNeeded: string; reviewStatus?: "DRAFT" | "REVIEWED"; minWords?: number; maxWords?: number };

function wordLimitLabel(s: Section): string | null {
  if (s.minWords === undefined && s.maxWords === undefined) return null;
  if (s.minWords !== undefined && s.maxWords !== undefined && s.minWords === s.maxWords) {
    return `${s.minWords} words`;
  }
  const min = s.minWords !== undefined ? `min ${s.minWords}` : null;
  const max = s.maxWords !== undefined ? `max ${s.maxWords}` : null;
  return [min, max].filter(Boolean).join(", ");
}

/**
 * Renders the donor's instructions parsed from the template for a section:
 * word limit, data table requirements (baseline/target/actuals, disaggregation),
 * charts/photos, evidence needs, and any other anticipated guidance.
 */
function instructionsFor(s: Section): string[] {
  const out: string[] = [];
  const limit = wordLimitLabel(s);
  if (limit) out.push(`Word limit: ${limit}.`);
  if (s.inputType === "INDICATOR_TABLE") {
    out.push("Data table with baseline, target, and actuals.");
    if (/disaggregat/i.test(s.description)) {
      out.push("Disaggregate results by sex, age, and disability where applicable.");
    }
  } else if (s.inputType === "TABLE") {
    out.push("Present the data in a table.");
    if (/disaggregat/i.test(s.description)) {
      out.push("Disaggregate by sex and age where applicable.");
    }
  } else if (s.inputType === "COMPLIANCE") {
    out.push("Report safeguarding and protection incidents; confirm PSEA measures.");
  }
  if (/chart|graph|photograph|photo|figure/i.test(s.description)) {
    out.push("Include charts and captioned photographs as required.");
  }
  if (s.evidenceNeeded.trim()) {
    out.push(`Evidence needed: ${s.evidenceNeeded.trim()}.`);
  }
  return out;
}

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
    <div className="mt-6 space-y-4">
      {sections.map((s, i) => {
        const instructions = instructionsFor(s);
        return (
          <div key={i} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {SECTION_INPUT_TYPE_LABEL[s.inputType] ?? s.inputType}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.required ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                {s.required ? "Required" : "Optional"}
              </span>
              {wordLimitLabel(s) && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  {wordLimitLabel(s)}
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">Section {i + 1}</span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">min</label>
                  <input
                    className="input w-20"
                    type="number"
                    min={0}
                    value={s.minWords ?? ""}
                    placeholder="—"
                    onChange={(e) => update(i, { minWords: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                  <label className="text-xs text-slate-500 dark:text-slate-400">max</label>
                  <input
                    className="input w-20"
                    type="number"
                    min={1}
                    value={s.maxWords ?? ""}
                    placeholder="—"
                    onChange={(e) => update(i, { maxWords: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Instructions from template</label>
                <textarea className="input" value={s.description} onChange={(e) => update(i, { description: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Evidence needed</label>
                <input className="input" value={s.evidenceNeeded} onChange={(e) => update(i, { evidenceNeeded: e.target.value })} />
              </div>
            </div>

            {instructions.length > 0 && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <p className="font-medium">What this section requires</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {instructions.map((line, li) => <li key={li}>{line}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button className="btn-danger" type="button" onClick={() => remove(i)}>Remove section</button>
            </div>
          </div>
        );
      })}

      <div className="flex gap-3">
        <button className="btn-secondary" type="button" onClick={add}>Add section</button>
        <button className="btn" type="button" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save template"}</button>
        {saved && <span className="self-center text-sm text-green-700 dark:text-green-400">Saved</span>}
      </div>
      {error && <InlineAlert tone="danger" title={error} />}
    </div>
  );
}
