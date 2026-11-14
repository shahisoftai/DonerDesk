import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The bulk-action bar (Version 4.000, plan F75): appears at the bottom of the screen while rows are ticked, says how many, offers
 * the actions that apply to all of them, and clears the selection. Every list with ticks uses it, so it looks the same everywhere.
 */
export function SelectionBar({ count, noun, onClear, children }: { count: number; noun: [string, string]; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Selected rows" className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex animate-pop-in flex-wrap items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-panel ring-1 ring-white/10 dark:bg-[#1d2a4f]">
        <span className="font-medium">{count} {count === 1 ? noun[0] : noun[1]} selected</span>
        <span className="h-5 w-px bg-white/20" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2 [&_.btn-secondary]:bg-white/10 [&_.btn-secondary]:text-white [&_.btn-secondary]:shadow-none">{children}</div>
        <button type="button" onClick={onClear} aria-label="Clear the selection" className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
