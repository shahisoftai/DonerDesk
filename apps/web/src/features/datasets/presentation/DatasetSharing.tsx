"use client";

import { useState } from "react";
import { columnKind, LAWFUL_BASES, SEMANTICS } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { setDatasetRestrictionAction, updateDatasetAction } from "@/lib/actions/datasets";
import type { DatasetDetail } from "../domain/types";

/**
 * What a share link may show (§1.3) and the Restricted tier (§8.2). Partner, donor and money columns are never on a link; any other column
 * can be hidden too. Only an administrator can make a dataset restricted, with a lawful basis, a purpose, a retention day and named viewers.
 */
export function DatasetSharing({ dataset, isAdmin, onChanged }: { dataset: DatasetDetail; isAdmin: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(new Set(dataset.sharePolicy.hidden));
  const [r, setR] = useState(dataset.restriction ?? { lawfulBasis: "CONSENT", purpose: "", retainUntil: "", viewerIds: [] as string[] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const always = (c: { semantic: string; kind: string; hideOnShareLinks: boolean }) => c.hideOnShareLinks || SEMANTICS.find((s) => s.key === c.semantic)?.shareable === false || columnKind(c.kind)?.money === true;
  const done = (res: { ok: boolean; error?: { message: string } }) => { setMsg(res.ok ? { ok: true, text: t("ds.saved") } : { ok: false, text: res.error?.message ?? "" }); if (res.ok) onChanged(); };
  return (
    <div className="space-y-6">
      <section className="space-y-2"><h3 className="text-sm font-semibold">{t("ds.share.title")}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("ds.share.intro")}</p>
        <ul className="grid gap-1 sm:grid-cols-2">{(dataset.current?.columns ?? []).map((c) => (
          <li key={c.key}><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!dataset.canManage || always(c)} checked={always(c) || hidden.has(c.key)} onChange={(e) => { const n = new Set(hidden); if (e.target.checked) n.add(c.key); else n.delete(c.key); setHidden(n); }} />{c.label}{always(c) && <span className="text-xs text-slate-500">{t("ds.share.always")}</span>}</label></li>
        ))}</ul>
        {dataset.canManage && <button type="button" className="rounded bg-brand-700 px-3 py-1 text-sm text-white" onClick={async () => done(await updateDatasetAction(dataset.id, { sharePolicy: { hidden: [...hidden] } }))}>{t("ds.save")}</button>}
      </section>
      {isAdmin && (
        <section className="space-y-2"><h3 className="text-sm font-semibold">{t("ds.restrict.title")}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("ds.restrict.intro")}</p>
          <label className="block text-sm">{t("ds.restrict.basis")} <select className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={r.lawfulBasis} onChange={(e) => setR({ ...r, lawfulBasis: e.target.value })}>{LAWFUL_BASES.map((b) => <option key={b} value={b}>{t(`ds.basis.${b}`)}</option>)}</select></label>
          <label className="block text-sm">{t("ds.restrict.purpose")}<textarea rows={2} className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={r.purpose} onChange={(e) => setR({ ...r, purpose: e.target.value })} /></label>
          <label className="block text-sm">{t("ds.restrict.until")} <input type="date" className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={r.retainUntil} onChange={(e) => setR({ ...r, retainUntil: e.target.value })} /></label>
          <label className="block text-sm">{t("ds.restrict.viewers")}<input className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={r.viewerIds.join(", ")} onChange={(e) => setR({ ...r, viewerIds: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>
          <div className="flex gap-2">
            <button type="button" className="rounded bg-red-700 px-3 py-1 text-sm text-white" onClick={async () => done(await setDatasetRestrictionAction(dataset.id, { restricted: true, restriction: r }))}>{t("ds.restrict.on")}</button>
            {dataset.restricted && <button type="button" className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={async () => done(await setDatasetRestrictionAction(dataset.id, { restricted: false }))}>{t("ds.restrict.off")}</button>}
          </div>
        </section>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
