"use client";

import { useState } from "react";
import { LEVEL_ORDER, parentOptions, type ResultOption } from "../domain/review-state";
import { useSetupCopy } from "./useSetupCopy";

/** Moving a result in the tree: its level and the result it sits under (only results above that level are offered). */
export function ResultMover({ id, code, level, parentCode, options, disabled, onMove }: {
  id: string; code: string; level: string; parentCode: string | null; options: ReadonlyArray<ResultOption>; disabled: boolean;
  onMove: (move: { level: string; parentCode: string | null }) => void;
}) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const [nextLevel, setLevel] = useState(level);
  const [nextParent, setParent] = useState<string | null>(parentCode);
  const parents = parentOptions(options, code, nextLevel);
  const parentValue = parents.some((p) => p.code === nextParent) ? nextParent : null;
  const changed = nextLevel !== level || parentValue !== parentCode;
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-slate-600 dark:text-slate-300">{rv.moveTitle}</summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1" htmlFor={`${id}-level`}>
          <span>{rv.levelLabel}</span>
          <select id={`${id}-level`} className="input py-1 text-xs" value={nextLevel} disabled={disabled} onChange={(e) => setLevel(e.target.value)}>
            {LEVEL_ORDER.map((l) => <option key={l} value={l}>{rv.levels[l] ?? l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1" htmlFor={`${id}-parent`}>
          <span>{rv.parentLabel}</span>
          <select id={`${id}-parent`} className="input max-w-xs py-1 text-xs" value={parentValue ?? ""} disabled={disabled || nextLevel === "GOAL"} onChange={(e) => setParent(e.target.value || null)}>
            <option value="">{rv.topLevel}</option>
            {parents.map((o) => <option key={o.code} value={o.code}>{`${rv.levels[o.level] ?? o.level} ${o.code} · ${o.title}`.slice(0, 90)}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary py-1 text-xs" disabled={disabled || !changed} onClick={() => onMove({ level: nextLevel, parentCode: nextLevel === "GOAL" ? null : parentValue })}>{rv.moveButton}</button>
      </div>
    </details>
  );
}
