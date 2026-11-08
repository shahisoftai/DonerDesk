"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { exportReviewSheetAction, importReviewSheetAction, recordReviewAction } from "@/lib/actions/sector-library";
import type { SectorReviewProgress } from "../domain/library-dto";

/**
 * Review of the sector library for this organisation (Phase 46.7): how far review has got per sector, the reviewer sheet that goes out
 * and comes back (any bad row blocks the whole sheet and is named), and marking a whole sector reviewed once someone has checked it.
 * Nothing the library says counts as reviewed until a person records it here.
 */
export function LibraryReviewPanel({ progress }: { progress: { sectors: SectorReviewProgress[]; total: number; reviewed: number } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reviewer, setReviewer] = useState("");
  const [sheet, setSheet] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [problems, setProblems] = useState<Array<{ row: number; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const download = async (sector?: string) => {
    const r = await exportReviewSheetAction(sector ? [sector] : []);
    if (!r.ok) { setError(r.error.message); return; }
    setError(null);
    const blob = new Blob([r.value.text], { type: "text/tab-separated-values" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sector-library-review${sector ? `-${sector.toLowerCase()}` : ""}.tsv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const send = async (apply: boolean) => {
    const r = await importReviewSheetAction({ text: sheet, reviewer, apply });
    if (!r.ok) { setError(r.error.message); return; }
    setError(null);
    setProblems(r.value.problems);
    setResult(r.value.problems.length > 0 ? null : apply ? t("lib.settings.progress", { count: r.value.decisions }) : `${r.value.decisions}`);
    if (apply && r.value.problems.length === 0) router.refresh();
  };
  const markSector = async (s: SectorReviewProgress, status: "REVIEWED" | "IN_REVIEW") => {
    // The ids of a sector come from the sheet export; marking by sector reads them there so the person sees exactly what is being marked.
    const sheetOut = await exportReviewSheetAction([s.sectorId]);
    if (!sheetOut.ok) { setError(sheetOut.error.message); return; }
    const ids = sheetOut.value.text.split("\n").slice(1).map((l) => l.split("\t")[0] ?? "").filter(Boolean);
    const r = await recordReviewAction({ entryIds: ids, status, reviewer });
    if (!r.ok) { setError(r.error.message); return; }
    setError(null);
    router.refresh();
  };

  return (
    <div className="space-y-6" data-testid="library-review">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("lib.settings.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{t("lib.unreviewedNote")} {t("lib.settings.progress", { count: `${progress.reviewed} / ${progress.total}` })}</p>
      </header>
      <label className="block max-w-sm text-sm">
        <span className="mb-1 block font-medium">Reviewer</span>
        <input className="input w-full" value={reviewer} onChange={(e) => setReviewer(e.target.value)} data-testid="reviewer-name" />
      </label>
      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="thead"><tr><th className="px-3 py-2 text-left">{t("lib.sectors")}</th><th className="px-3 py-2 text-right">{t("lib.review.UNREVIEWED")}</th><th className="px-3 py-2 text-right">{t("lib.review.IN_REVIEW")}</th><th className="px-3 py-2 text-right">{t("lib.review.REVIEWED")}</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {progress.sectors.map((s) => (
              <tr key={s.sectorId} className="trow" data-testid={`review-row-${s.sectorId}`}>
                <td className="px-3 py-2">{s.label}</td>
                <td className="px-3 py-2 text-right">{s.byStatus.UNREVIEWED}</td>
                <td className="px-3 py-2 text-right">{s.byStatus.IN_REVIEW}</td>
                <td className="px-3 py-2 text-right">{s.byStatus.REVIEWED}</td>
                <td className="flex flex-wrap justify-end gap-2 px-3 py-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => void download(s.sectorId)}>{t("lib.settings.export")}</button>
                  <button type="button" className="btn-secondary text-xs" disabled={!reviewer.trim()} onClick={() => void markSector(s, "REVIEWED")}>{t("lib.review.REVIEWED")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="space-y-2">
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => void download()}>{t("lib.settings.export")}</button>
        </div>
        <label className="block text-sm"><span className="mb-1 block font-medium">{t("lib.settings.import")}</span>
          <textarea className="input h-32 w-full font-mono text-xs" value={sheet} onChange={(e) => setSheet(e.target.value)} data-testid="review-sheet" />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={!sheet.trim()} onClick={() => void send(false)}>{t("lib.settings.check")}</button>
          <button type="button" className="btn text-xs" disabled={!sheet.trim()} onClick={() => void send(true)}>{t("lib.settings.apply")}</button>
        </div>
        {result ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{result}</p> : null}
        {problems.length > 0 ? <ul role="alert" className="list-disc ps-5 text-sm text-danger-600">{problems.map((p) => <li key={p.row}>Row {p.row}: {p.message}</li>)}</ul> : null}
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      </section>
    </div>
  );
}
