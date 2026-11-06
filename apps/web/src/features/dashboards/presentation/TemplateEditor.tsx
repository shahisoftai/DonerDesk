"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TEMPLATE_AUDIENCES, TEMPLATE_SECTORS, TEMPLATE_SECTOR_ORDER, addTemplateRole, addTemplateWidget, copyTemplate, moveTemplateWidget, removeTemplateRole, removeTemplateWidget, resizeTemplateWidget,
  templateProblems, updateTemplateDetails, updateTemplateRole, updateTemplateWidget, type DashboardTemplate, type TemplateEdit, type TemplateWidget,
} from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";
import { CHART_KINDS, kindsForTemplate, type ChartKind } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { DATA_CHART_TEMPLATES, type DataChartTemplate } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { deleteDashboardTemplateAction, saveDashboardTemplateAction } from "@/lib/actions/dashboards";

const btn = "btn-secondary px-2 py-1 text-xs";
const input = "input px-2 py-1 text-xs";
const MEASURES = ["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"] as const;
const TYPES = ["COUNT", "PERCENTAGE", "RATIO", "CURRENCY", "ANY"] as const;
const SIZES: Array<[string, number, number]> = [["Half width", 6, 4], ["Full width", 12, 4], ["Third", 4, 4], ["Tall half", 6, 6]];
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36);

/**
 * The template editor: details, indicator roles and charts, with the domain's editing tools (a change that would leave a template that
 * cannot be applied is refused with the reason). A built-in template is read-only here: copy it from the gallery to change it.
 */
export function TemplateEditor({ template: initial, updatedAt, canEdit }: { template: DashboardTemplate; updatedAt?: string | undefined; canEdit: boolean }) {
  const router = useRouter();
  const [t, setT] = useState<DashboardTemplate>(initial);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState("");
  const editable = canEdit && initial.origin === "ORGANISATION";
  const problems = useMemo(() => templateProblems(t), [t]);

  function run(r: TemplateEdit) {
    if (!r.ok) { setMessage({ tone: "error", text: r.reason }); return; }
    setT(r.template); setDirty(true); setMessage(null);
  }
  async function save() {
    setBusy(true);
    const r = await saveDashboardTemplateAction({ title: t.title, description: t.description, sector: t.sector, audience: t.audience, roles: t.roles, widgets: t.widgets, ...(t.basedOn ? { basedOn: t.basedOn } : {}), ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}) }, t.id);
    setBusy(false);
    if (!r.ok) { setMessage({ tone: "error", text: r.error.message }); return; }
    setDirty(false); setMessage({ tone: "ok", text: "Saved." });
    router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Delete “${t.title}”?`)) return;
    const r = await deleteDashboardTemplateAction(t.id);
    if (!r.ok) { setMessage({ tone: "error", text: r.error.message }); return; }
    router.push("/dashboards/templates");
  }
  async function copy() {
    setBusy(true);
    const c = copyTemplate(t, { id: "new" });
    const r = await saveDashboardTemplateAction({ title: c.title, description: c.description, sector: c.sector, audience: c.audience, roles: c.roles, widgets: c.widgets, basedOn: t.id });
    setBusy(false);
    if (!r.ok) { setMessage({ tone: "error", text: r.error.message }); return; }
    router.push(`/dashboards/templates/${r.value.id}`);
  }
  const widget = (w: TemplateWidget) => {
    const c = w.chart;
    const kinds = c ? kindsForTemplate(c.template) : [];
    return (
      <li key={w.id} className="space-y-1.5 rounded-lg border border-slate-200 p-2 dark:border-white/10" data-widget={w.id}>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label={`Title of ${w.title || w.id}`} className={`${input} min-w-0 flex-1`} value={w.title} disabled={!editable} onChange={(e) => run(updateTemplateWidget(t, w.id, { title: e.target.value }))} />
          {editable && (
            <>
              <button type="button" className={btn} onClick={() => run(moveTemplateWidget(t, w.id, w.x, Math.max(0, w.y - 1)))}>Up</button>
              <button type="button" className={btn} onClick={() => run(moveTemplateWidget(t, w.id, w.x, w.y + 1))}>Down</button>
              <select aria-label={`Size of ${w.title || w.id}`} className={input} value="" onChange={(e) => { const s = SIZES[Number(e.target.value)]!; run(resizeTemplateWidget(t, w.id, s[1], s[2])); }}><option value="">{w.w}×{w.h}</option>{SIZES.map((s, i) => <option key={s[0]} value={i}>{s[0]}</option>)}</select>
              <button type="button" className="text-xs text-red-700 underline dark:text-red-300" onClick={() => run(removeTemplateWidget(t, w.id))}>Remove</button>
            </>
          )}
        </div>
        {c ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label={`Data of ${w.title || w.id}`} className={input} disabled={!editable} value={c.template} onChange={(e) => { const tp = e.target.value as DataChartTemplate; const ok = kindsForTemplate(tp); run(updateTemplateWidget(t, w.id, { chart: { ...c, template: tp, kind: ok.includes(c.kind) ? c.kind : (ok[0] ?? "BAR"), roleKeys: DATA_CHART_TEMPLATES[tp].indicators === "none" ? [] : DATA_CHART_TEMPLATES[tp].indicators === "one" ? c.roleKeys.slice(0, 1).length ? c.roleKeys.slice(0, 1) : t.roles.slice(0, 1).map((r) => r.key) : c.roleKeys.length ? c.roleKeys : t.roles.slice(0, 2).map((r) => r.key) } })); }}>
              {(Object.keys(DATA_CHART_TEMPLATES) as DataChartTemplate[]).map((k) => <option key={k} value={k}>{DATA_CHART_TEMPLATES[k].label}</option>)}
            </select>
            <select aria-label={`Chart type of ${w.title || w.id}`} className={input} disabled={!editable} value={c.kind} onChange={(e) => run(updateTemplateWidget(t, w.id, { chart: { ...c, kind: e.target.value as ChartKind } }))}>
              {kinds.map((k) => <option key={k} value={k}>{CHART_KINDS[k].label}</option>)}
            </select>
            <select aria-label={`Measure of ${w.title || w.id}`} className={input} disabled={!editable} value={c.measure} onChange={(e) => run(updateTemplateWidget(t, w.id, { chart: { ...c, measure: e.target.value as typeof c.measure } }))}>{MEASURES.map((m) => <option key={m} value={m}>{m === "PERIOD" ? "Period value" : m === "CUMULATIVE" ? "Cumulative" : "% of target"}</option>)}</select>
            {DATA_CHART_TEMPLATES[c.template].indicators !== "none" && (
              <span className="flex flex-wrap gap-2">{t.roles.map((r) => (
                <label key={r.key} className="flex items-center gap-1"><input type={DATA_CHART_TEMPLATES[c.template].indicators === "one" ? "radio" : "checkbox"} disabled={!editable} checked={c.roleKeys.includes(r.key)} onChange={() => {
                  const one = DATA_CHART_TEMPLATES[c.template].indicators === "one";
                  const roleKeys = one ? [r.key] : c.roleKeys.includes(r.key) ? c.roleKeys.filter((k) => k !== r.key) : [...c.roleKeys, r.key];
                  run(updateTemplateWidget(t, w.id, { chart: { ...c, roleKeys } }));
                }} />{r.label}</label>
              ))}</span>
            )}
          </div>
        ) : <textarea aria-label={`Text of ${w.title || w.id}`} className={`${input} w-full`} rows={2} disabled={!editable} value={w.text ?? ""} onChange={(e) => run(updateTemplateWidget(t, w.id, { text: e.target.value }))} />}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
        <span className="rounded-full border px-2 py-0.5 text-[11px]">{initial.origin === "BUILT_IN" ? "Draft template (built in)" : "Your template"}</span>
        <span className="ms-auto flex items-center gap-2">
          {!editable && canEdit && <button type="button" className="btn px-3 py-1.5 text-sm" onClick={() => void copy()} disabled={busy}>Copy and edit</button>}
          {editable && <button type="button" className="btn px-3 py-1.5 text-sm" onClick={() => void save()} disabled={busy || !dirty || problems.length > 0}>Save</button>}
          {editable && <button type="button" className={btn} onClick={() => void remove()}>Delete</button>}
        </span>
      </header>
      {message && <p role={message.tone === "error" ? "alert" : "status"} data-testid="editor-message" className={message.tone === "error" ? "text-sm text-danger-600" : "text-sm text-emerald-700 dark:text-emerald-300"}>{message.text}</p>}

      <section className="card space-y-2" aria-label="Details">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs">Title<input aria-label="Template title" className={`${input} block w-full`} disabled={!editable} value={t.title} onChange={(e) => run(updateTemplateDetails(t, { title: e.target.value }))} /></label>
          <label className="text-xs">Sector<select aria-label="Sector" className={`${input} block w-full`} disabled={!editable} value={t.sector} onChange={(e) => run(updateTemplateDetails(t, { sector: e.target.value as typeof t.sector }))}>{TEMPLATE_SECTOR_ORDER.map((s) => <option key={s} value={s}>{TEMPLATE_SECTORS[s].label}</option>)}</select></label>
          <label className="text-xs md:col-span-2">Description<textarea aria-label="Description" rows={2} className={`${input} block w-full`} disabled={!editable} value={t.description} onChange={(e) => run(updateTemplateDetails(t, { description: e.target.value }))} /></label>
          <label className="text-xs">For<select aria-label="Audience" className={`${input} block w-full`} disabled={!editable} value={t.audience} onChange={(e) => run(updateTemplateDetails(t, { audience: e.target.value as typeof t.audience }))}>{TEMPLATE_AUDIENCES.map((a) => <option key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</option>)}</select></label>
        </div>
      </section>

      <section className="card space-y-2" aria-label="Indicator roles">
        <h2 className="text-sm font-semibold">What to show (indicator roles)</h2>
        <ul className="space-y-2">
          {t.roles.map((r) => (
            <li key={r.key} className="grid gap-1 md:grid-cols-[1fr_1fr_auto] md:items-center" data-role={r.key}>
              <input aria-label={`Name of ${r.key}`} className={input} disabled={!editable} value={r.label} onChange={(e) => run(updateTemplateRole(t, r.key, { label: e.target.value }))} />
              <input aria-label={`Words to look for in ${r.key}`} className={input} disabled={!editable} value={r.keywords.join(", ")} placeholder="words an indicator name contains" onChange={(e) => run(updateTemplateRole(t, r.key, { keywords: e.target.value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) }))} />
              <span className="flex items-center gap-2 text-xs">
                <select aria-label={`Kind of ${r.key}`} className={input} disabled={!editable} value={r.types[0] ?? "ANY"} onChange={(e) => run(updateTemplateRole(t, r.key, { types: [e.target.value as (typeof TYPES)[number]] }))}>{TYPES.map((x) => <option key={x} value={x}>{x.charAt(0) + x.slice(1).toLowerCase()}</option>)}</select>
                <label className="flex items-center gap-1"><input type="checkbox" disabled={!editable} checked={r.required} onChange={(e) => run(updateTemplateRole(t, r.key, { required: e.target.checked }))} />Needed</label>
                {editable && <button type="button" className="text-red-700 underline dark:text-red-300" onClick={() => run(removeTemplateRole(t, r.key))}>Remove</button>}
              </span>
            </li>
          ))}
        </ul>
        {editable && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const key = slug(newRole); if (!key) return; run(addTemplateRole(t, { key, label: newRole.trim(), hint: "", keywords: [], types: ["ANY"], required: false })); setNewRole(""); }}>
            <input aria-label="New role name" placeholder="Add a role, e.g. Latrines built" className={`${input} flex-1`} value={newRole} onChange={(e) => setNewRole(e.target.value)} />
            <button type="submit" className={btn}>Add role</button>
          </form>
        )}
      </section>

      <section className="card space-y-2" aria-label="Charts">
        <h2 className="text-sm font-semibold">Charts and notes</h2>
        <ul className="space-y-2">{t.widgets.map(widget)}</ul>
        {editable && (
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => run(addTemplateWidget(t, { id: `w${Date.now()}`, kind: "CHART", title: "New chart", chart: { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: t.roles.slice(0, 1).map((r) => r.key), measure: "CUMULATIVE", showTarget: true } }))}>Add a chart</button>
            <button type="button" className={btn} onClick={() => run(addTemplateWidget(t, { id: `w${Date.now()}`, kind: "TEXT", title: "Note", text: "Write a note here.", w: 12, h: 2 }))}>Add a note</button>
          </div>
        )}
      </section>

      <section className="card" aria-label="Layout">
        <h2 className="mb-2 text-sm font-semibold">Layout</h2>
        <div className="relative w-full rounded border border-dashed border-slate-300 dark:border-white/20" style={{ height: Math.max(4, ...t.widgets.map((w) => w.y + w.h)) * 28 }} data-testid="layout">
          {t.widgets.map((w) => <div key={w.id} className="absolute overflow-hidden rounded border border-brand-400 bg-brand-50/60 px-1 text-[11px] dark:bg-brand-400/10" style={{ left: `${(w.x / 12) * 100}%`, top: w.y * 28, width: `${(w.w / 12) * 100}%`, height: w.h * 28 - 4 }} title={w.title}>{w.title}</div>)}
        </div>
      </section>
    </div>
  );
}
