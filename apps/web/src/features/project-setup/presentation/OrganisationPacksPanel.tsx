"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removePackAction, savePackAction } from "@/lib/actions/setup-packs";
import type { OrganisationPacks } from "@/lib/server/schemas-setup-packs";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PCW_COPY } from "../pcw/copy";
import { SECTOR_OPTIONS } from "../pcw/domain/pcw-view";
import { GENERAL, formFrom, inputFrom, type PackFormState } from "../domain/pack-form";

const KEYS = [GENERAL, ...SECTOR_OPTIONS] as const;
const nameOf = (key: string): string => (key === GENERAL ? "Any sector (general)" : PCW_COPY.common.sectors[key] ?? key);

/** Settings: the organisation's own starting answers per sector, beside what ships with DonorDesk. Administrators only (the page checks). */
export function OrganisationPacksPanel({ packs }: { packs: OrganisationPacks }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PackFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const own = new Map(packs.own.map((o) => [o.sectorKey, o]));
  const builtIn = (key: string) => packs.builtIn.find((p) => (p.sector ?? GENERAL) === key) ?? null;

  const save = () => editing && startTransition(async () => {
    const r = await savePackAction(inputFrom(editing));
    if (!r.ok) return setError(r.error.message);
    setError(null); setEditing(null); router.refresh();
  });
  const remove = (key: string) => startTransition(async () => {
    const r = await removePackAction(key);
    if (!r.ok) return setError(r.error.message);
    setError(null); setEditing(null); router.refresh();
  });
  const set = (patch: Partial<PackFormState>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
        {KEYS.map((key) => {
          const mine = own.get(key);
          const base = builtIn(key);
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{nameOf(key)}</span>
                <span className="block text-slate-600 dark:text-slate-300">{mine ? `Your own: ${mine.pack.label}` : base ? `Built in: ${base.label}` : "No starting answers"}</span>
              </span>
              <span className="flex gap-2">
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => { setError(null); setEditing(formFrom(key, mine?.pack ?? base)); }}>{mine ? "Edit" : "Write our own"}</button>
                {mine ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => remove(key)}>Use the built-in one</button> : null}
              </span>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <fieldset className="space-y-4 rounded-xl border border-dashed border-slate-300 p-4 dark:border-white/20">
          <legend className="px-1 text-sm font-semibold">{nameOf(editing.sector)}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name of this pack"><Input value={editing.label} onChange={(e) => set({ label: e.target.value })} /></Field>
            <Field label="Reports are made">
              <Select value={editing.cadence} onChange={(e) => set({ cadence: e.target.value })}><option value="">— not set —</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option></Select>
            </Field>
            <Field label="How values are checked">
              <Select value={editing.reviewMode} onChange={(e) => set({ reviewMode: e.target.value })}><option value="">— not set —</option><option value="SIMPLE">Simple</option><option value="FULL">Full</option></Select>
            </Field>
            <Field label="Entry opens (days before the period ends)"><Input inputMode="numeric" value={editing.opens} onChange={(e) => set({ opens: e.target.value })} /></Field>
            <Field label="Entry closes (days after the period ends)"><Input inputMode="numeric" value={editing.closes} onChange={(e) => set({ closes: e.target.value })} /></Field>
            <Field label="Starting dashboard">
              <Select value={editing.dashboard} onChange={(e) => set({ dashboard: e.target.value })}>
                <option value="">— none —</option>
                {packs.dashboards.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Reports</h3>
            {editing.rules.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Kind of report (for example QUARTERLY)"><Input value={r.reportType} onChange={(e) => set({ rules: editing.rules.map((x, j) => (j === i ? { ...x, reportType: e.target.value } : x)) })} /></Field>
                <Field label="Due (days after the period ends)"><Input inputMode="numeric" value={r.due} onChange={(e) => set({ rules: editing.rules.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} /></Field>
                <div className="self-end"><button type="button" className="btn-secondary" onClick={() => set({ rules: editing.rules.filter((_, j) => j !== i) })}>Remove</button></div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => set({ rules: [...editing.rules, { reportType: "", due: "30" }] })}>Add a kind of report</button>
            <p className="text-xs text-slate-600 dark:text-slate-300">Reports use the standard layout. A donor&apos;s own layout is uploaded per project once it has started.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Usual risks</h3>
            {editing.risks.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
                <Field label="What might go wrong"><Input value={r.title} onChange={(e) => set({ risks: editing.risks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /></Field>
                <Field label="How serious">
                  <Select value={r.seriousness} onChange={(e) => set({ risks: editing.risks.map((x, j) => (j === i ? { ...x, seriousness: e.target.value } : x)) })}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></Select>
                </Field>
                <Field label="What will be done"><Input value={r.mitigation} onChange={(e) => set({ risks: editing.risks.map((x, j) => (j === i ? { ...x, mitigation: e.target.value } : x)) })} /></Field>
                <div className="self-end"><button type="button" className="btn-secondary" onClick={() => set({ risks: editing.risks.filter((_, j) => j !== i) })}>Remove</button></div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => set({ risks: [...editing.risks, { title: "", seriousness: "MEDIUM", mitigation: "" }] })}>Add a risk</button>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn" disabled={pending} onClick={save}>Save</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </fieldset>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
