"use client";

import { useMemo, useState } from "react";
import { BLOCK_KINDS, conversionLosses, definitionFor, isContainerKind, type BlockInstance } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey } from "../domain/canvas-copy";

/** Change a block to another kind: what would be lost is named first, and the change is made only once the person accepts it. */
export function ConvertDialog({ block, onConvert, onClose }: { block: BlockInstance; onConvert: (kind: string, acceptLoss: boolean) => void; onClose: () => void }) {
  const { t } = useI18n();
  const choices = useMemo(() => BLOCK_KINDS.filter((k) => k !== block.kind && definitionFor(k) && !isContainerKind(k)), [block.kind]);
  const [kind, setKind] = useState(choices[0] ?? "");
  const lost = kind ? conversionLosses(block, kind) : [];
  return (
    <div role="dialog" aria-modal="true" aria-label={t("editor.convert.title")} className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24 print:hidden" onClick={onClose} data-testid="convert-dialog">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{t("editor.convert.title")}</h2>
        <label className="block space-y-1 text-sm"><span className="font-medium">{t("editor.convert.to")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900">{choices.map((k) => <option key={k} value={k}>{t(blockLabelKey(k as never))}</option>)}</select>
        </label>
        {lost.length > 0 && <p role="status" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("editor.convert.drops", { names: lost.join(", ") })}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">{t("editor.convert.cancel")}</button>
          <button type="button" disabled={!kind} onClick={() => { onConvert(kind, lost.length > 0); onClose(); }} className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800">{lost.length > 0 ? t("editor.convert.keepGoing") : t("editor.convert.apply")}</button>
        </div>
      </div>
    </div>
  );
}
