"use client";

import { Dialog } from "@/components/feedback/Dialog";
import { SHORTCUTS } from "../../application/shortcuts";

/** The keyboard shortcut sheet (`?`, Report Editor U19). */
export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <p className="text-sm text-slate-600 dark:text-slate-300">Shortcuts work when you are not typing in a field or the editor.</p>
      <dl className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="flex items-center justify-between gap-4 py-2 text-sm">
            <dt>{s.label}</dt>
            <dd>
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs dark:border-white/20 dark:bg-white/5">{s.keys}</kbd>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-2 text-sm">
          <dt>Add or edit a link while editing</dt>
          <dd>
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs dark:border-white/20 dark:bg-white/5">Ctrl/⌘+K</kbd>
          </dd>
        </div>
      </dl>
    </Dialog>
  );
}
