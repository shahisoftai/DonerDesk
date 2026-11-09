"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CANVAS_COMMANDS, commandEnabled, searchCommands, shortcutLabel, type CanvasCommand, type EditorState } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** ⌘K: type what you want to do and run it. Every command is also reachable from its shortcut and the menus; this is the way to find one you do not remember. */
export function CommandPalette({ state, onRun, onClose }: { state: EditorState; onRun: (id: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nameOf = (c: CanvasCommand): string => t(`editor.cmd.${c.id}` as never);
  const hits = useMemo(() => (text.trim() ? searchCommands(text, nameOf, state) : [...CANVAS_COMMANDS]), [text, state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setIndex(0), [text]);

  const choose = (c: CanvasCommand | undefined): void => { if (c && commandEnabled(c, state)) { onClose(); onRun(c.id); } };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(hits[index]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t("editor.palette.title")} className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24 print:hidden" onClick={onClose} data-testid="command-palette">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={t("editor.palette.placeholder")} aria-label={t("editor.palette.placeholder")} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={hits[index] ? `cmd-${hits[index]!.id}` : undefined}
          className="w-full rounded-t-xl border-b border-slate-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-slate-700" />
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-auto py-1">
          {hits.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">{t("editor.palette.none")}</li>}
          {hits.map((c, i) => {
            const enabled = commandEnabled(c, state);
            return (
              <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === index} aria-disabled={!enabled || undefined} onMouseEnter={() => setIndex(i)} onClick={() => choose(c)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === index ? "bg-sky-50 dark:bg-slate-800" : ""} ${enabled ? "" : "opacity-50"}`}>
                <span>{nameOf(c)} <span className="text-xs text-slate-500">· {t(`editor.group.${c.group}` as never)}{enabled ? "" : ` · ${t("editor.palette.unavailable")}`}</span></span>
                {c.shortcut && <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">{shortcutLabel(c.shortcut, isMac())}</kbd>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
