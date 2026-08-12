"use client";

import { useState } from "react";

/**
 * A small contextual help affordance. Renders a toggle that expands an inline
 * explanation; keyboard accessible with proper ARIA wiring.
 */
export function InlineHelp({ help }: { help: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-label="More information"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:text-slate-300"
      >
        ?
      </button>
      {open && (
        <span role="note" className="mt-1 block rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          {help}
        </span>
      )}
    </span>
  );
}
