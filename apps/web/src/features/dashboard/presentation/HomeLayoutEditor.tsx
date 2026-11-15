"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetHomeLayoutAction, saveHomeLayoutAction } from "@/lib/actions/home-layout";
import {
  movePlacement, sameArrangement, setPlacementHidden, setPlacementSpan, toStored, type Arrangement, type PanelCatalogue, type PanelSpan,
} from "../domain/arrangement";
import { PANEL_INFO, defaultLayout, type HomeLayout } from "../domain/home-layout";
import { LAYOUT_COPY, PANEL_LABEL, SPAN_LABEL } from "../domain/home-layout-copy";
import type { HomeVariant } from "@/features/navigation/domain/role-navigation";

/** Arrange Home: the shared arrange list over Home's panels. */
export function HomeLayoutEditor({ variant, initial, version }: { variant: HomeVariant; initial: HomeLayout; version: string | null }) {
  return (
    <ArrangeEditor
      variant={variant} initial={initial} defaults={defaultLayout(variant)} version={version} info={PANEL_INFO} labels={PANEL_LABEL}
      copy={{ open: LAYOUT_COPY.open, title: LAYOUT_COPY.title, intro: LAYOUT_COPY.intro }}
    />
  );
}

/**
 * The list a person uses to arrange a page of panels (Home, a project's Overview): earlier / later, width, shown or hidden. Buttons and a select, not dragging, so it works from the keyboard and on a phone.
 * Every edit is a pure function of the domain layout rules; nothing is saved until Save, and Cancel drops the edit. It only changes what it is given: the
 * panels a role may see were already decided when `initial` was read.
 */
export function ArrangeEditor<K extends string>({ variant, initial, defaults, version, info, labels, copy }: {
  /** The stored arrangement's name (a Home variant, or PROJECT). */
  variant: string;
  initial: Arrangement<K>;
  defaults: Arrangement<K>;
  version: string | null;
  info: PanelCatalogue<K>;
  labels: Readonly<Record<K, string>>;
  copy: { open: string; title: string; intro: string };
}) {
  const PANEL_LABEL = labels;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Arrangement<K>>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = !sameArrangement(draft, initial);
  const isDefault = sameArrangement(initial, defaults);

  const close = () => { setOpen(false); setDraft(initial); setMessage(null); };
  const apply = (next: Arrangement<K> | null) => { if (next) setDraft(next); };

  const save = () => startTransition(async () => {
    const r = await saveHomeLayoutAction({ variant, layout: toStored(draft), expectedUpdatedAt: version });
    if (!r.ok) { setMessage(r.error.message); return; }
    setOpen(false); setMessage(null);
    router.refresh();
  });
  const reset = () => startTransition(async () => {
    const r = await resetHomeLayoutAction(variant);
    if (!r.ok) { setMessage(LAYOUT_COPY.resetFailed); return; }
    setOpen(false); setMessage(null);
    router.refresh();
  });

  if (!open) return <button type="button" className="btn-secondary" onClick={() => { setDraft(initial); setOpen(true); }}>{copy.open}</button>;

  const btn = "rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10";
  return (
    <section aria-label={copy.title} className="card w-full space-y-3">
      <div>
        <h2 className="text-sm font-medium">{copy.title}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.intro}</p>
      </div>
      <ol className="divide-y divide-slate-200/70 rounded-lg border border-slate-200/70 dark:divide-white/10 dark:border-white/10">
        {draft.map((p, i) => (
          <li key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="flex gap-1">
              <button type="button" className={btn} disabled={i === 0} aria-label={`Move ${PANEL_LABEL[p.key]} earlier`} onClick={() => apply(movePlacement(draft, p.key, -1))}>↑</button>
              <button type="button" className={btn} disabled={i === draft.length - 1} aria-label={`Move ${PANEL_LABEL[p.key]} later`} onClick={() => apply(movePlacement(draft, p.key, 1))}>↓</button>
            </span>
            <span className={`min-w-0 flex-1 text-sm ${p.hidden ? "text-slate-400 line-through dark:text-slate-500" : "font-medium"}`}>{PANEL_LABEL[p.key]}</span>
            <WidthSelect spans={info[p.key].spans} label={PANEL_LABEL[p.key]} value={p.span} onChange={(s) => apply(setPlacementSpan(info, draft, p.key, s))} />
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={!p.hidden} onChange={(e) => apply(setPlacementHidden(draft, p.key, !e.target.checked))} />{LAYOUT_COPY.show}<span className="sr-only"> {PANEL_LABEL[p.key]}</span></label>
          </li>
        ))}
      </ol>
      {message && <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">{message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={!changed || pending} onClick={save}>{LAYOUT_COPY.save}</button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={close}>{LAYOUT_COPY.cancel}</button>
        {!isDefault && <button type="button" className="btn-secondary ms-auto" disabled={pending} onClick={reset}>{LAYOUT_COPY.reset}</button>}
        {!changed && <span className="text-xs text-slate-500 dark:text-slate-400">{LAYOUT_COPY.unchanged}</span>}
      </div>
    </section>
  );
}

function WidthSelect({ spans, label, value, onChange }: { spans: ReadonlyArray<PanelSpan>; label: string; value: PanelSpan; onChange: (s: PanelSpan) => void }) {
  if (spans.length === 1) return <span className="text-xs text-slate-500 dark:text-slate-400">{SPAN_LABEL[value]}</span>;
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="sr-only">{LAYOUT_COPY.width}: {label}</span>
      <select className="input py-1" value={value} onChange={(e) => onChange(Number(e.target.value) as PanelSpan)}>
        {spans.map((s) => <option key={s} value={s}>{SPAN_LABEL[s]}</option>)}
      </select>
    </label>
  );
}
