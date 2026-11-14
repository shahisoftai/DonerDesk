"use client";

import { COLUMN_KINDS, SEMANTICS } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { DatasetDetail } from "../domain/types";

const kindLabel = (k: string) => COLUMN_KINDS.find((x) => x.key === k)?.label ?? k;
const semLabel = (k: string) => SEMANTICS.find((x) => x.key === k)?.label ?? k;

/** The columns, figures, tidy steps and open data notes of the current version, in plain words. */
export function DatasetOverview({ dataset }: { dataset: DatasetDetail }) {
  const { t } = useI18n();
  const cur = dataset.current;
  if (!cur) return <p className="text-sm text-slate-500">{t("ds.page.noVersion")}</p>;
  return (
    <div className="space-y-4">
      {dataset.description && <p className="text-sm">{dataset.description}</p>}
      <p className="text-xs text-slate-500">{cur.summary}</p>
      <section><h3 className="mb-1 text-sm font-semibold">{t("ds.page.columns")}</h3>
        <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500"><th className="text-start">{t("ds.columns.header")}</th><th className="text-start">{t("ds.columns.holds")}</th><th className="text-start">{t("ds.columns.means")}</th><th className="text-start">{t("ds.page.onLinks")}</th></tr></thead>
          <tbody>{cur.columns.map((c) => <tr key={c.key} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1">{c.label}{c.role ? <span className="ms-1 text-xs text-sky-700">({c.role})</span> : null}</td><td>{kindLabel(c.kind)}{c.rateParts ? ` ${t("ds.page.fromParts")}` : ""}</td><td>{semLabel(c.semantic)}</td><td>{c.hideOnShareLinks || dataset.sharePolicy.hidden.includes(c.key) ? t("ds.page.hidden") : t("ds.page.shown")}</td></tr>)}</tbody></table>
      </section>
      {cur.figures.length > 0 && <section><h3 className="mb-1 text-sm font-semibold">{t("ds.page.figures")}</h3><ul className="space-y-1 text-sm">{cur.figures.map((f) => <li key={f.id}><span className="font-medium">{f.label}</span>: <span className="text-slate-600">{f.sentence}</span></li>)}</ul></section>}
      {cur.steps.length > 0 && <section><h3 className="mb-1 text-sm font-semibold">{t("ds.page.steps")}</h3><ol className="list-decimal ps-5 text-sm">{cur.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>}
      <section><h3 className="mb-1 text-sm font-semibold">{t("ds.page.notes", { n: cur.findings.length })}</h3>
        {cur.findings.length === 0 ? <p className="text-sm text-emerald-800">{t("ds.check.clean")}</p> : <ul className="list-disc ps-5 text-sm">{cur.findings.slice(0, 40).map((f, i) => <li key={i} className={f.severity === "BLOCK" ? "text-red-800" : ""}>{f.message}</li>)}</ul>}
      </section>
    </div>
  );
}
