"use client";

import type { ResultOption, RowLink } from "../domain/review-state";
import { useSetupCopy } from "./useSetupCopy";

/** Where an item sits and the control to move it: one select of the proposed results, "No result" first. */
export function ResultPicker({ id, link, options, disabled, onChoose }: {
  id: string; link: RowLink; options: ReadonlyArray<ResultOption>; disabled: boolean; onChoose: (code: string | null) => void;
}) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const where = link.code ? rv.placedUnder(`${link.code} ${link.title ?? ""}`.trim()) : rv.notPlaced;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className={link.code ? "text-slate-700 dark:text-slate-200" : "font-medium text-amber-800 dark:text-amber-200"}>
        {where}{link.code ? <span className="ms-1 text-slate-500 dark:text-slate-400">({rv.linkSource[link.source]})</span> : null}
      </span>
      {options.length > 0 && (
        <>
          <label htmlFor={id} className="sr-only">{rv.chooseResult}</label>
          <select
            id={id}
            className="input max-w-xs py-1 text-xs"
            disabled={disabled}
            value={link.code ?? ""}
            onChange={(e) => onChoose(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">{rv.noResult}</option>
            {options.map((o) => <option key={o.code} value={o.code}>{`${rv.levels[o.level] ?? o.level} ${o.code} · ${o.title}`.slice(0, 90)}</option>)}
          </select>
        </>
      )}
    </div>
  );
}
