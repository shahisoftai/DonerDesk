"use client";

import { useEffect, useRef } from "react";
import { CANVAS_COMMANDS, COMMAND_GROUPS, shortcutLabel } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Every shortcut, grouped, from the same table the keyboard reads: the sheet can never list a key that does nothing. */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div role="dialog" aria-modal="true" aria-label={t("editor.shortcuts.title")} className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-16 print:hidden" onClick={onClose} data-testid="shortcut-sheet">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{t("editor.shortcuts.title")}</h2><button ref={close} type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-600">{t("editor.shortcuts.close")}</button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMMAND_GROUPS.map((g) => {
            const rows = CANVAS_COMMANDS.filter((c) => c.group === g && c.shortcut);
            if (rows.length === 0) return null;
            return (
              <section key={g} aria-label={t(`editor.group.${g}` as never)}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`editor.group.${g}` as never)}</h3>
                <dl className="space-y-1 text-sm">{rows.map((c) => <div key={c.id} className="flex justify-between gap-3"><dt>{t(`editor.cmd.${c.id}` as never)}</dt><dd><kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600">{shortcutLabel(c.shortcut!, isMac())}</kbd></dd></div>)}</dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
